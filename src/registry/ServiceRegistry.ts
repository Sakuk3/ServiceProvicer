import type { ServiceKey, Services } from "./serviceTypes";
import type {
  CreateReadyHooksProps,
  DependencyRecord,
  FailedEntry,
  FailedServiceInfo,
  HookPolicyMap,
  HookTask,
  LifecycleHookPolicy,
  ResolvedLifecycleHookPolicy,
  ReadyEntry,
  ReadyHooks,
  RegistryEventName,
  ServiceEntry,
  TriggerEventFailure,
  TriggerEventResult,
  UnresolvedServiceInfo,
  WaitingServiceInfo,
  WaitingEntry,
} from "./types";
import { HookExecutionError } from "./types";
import type { ServiceHooks, ServiceManifest } from "./manifest";

/**
 * Registers service manifests, resolves dependencies, and executes lifecycle hooks.
 */
export class ServiceRegistry {
  private readonly serviceStore = new Map<ServiceKey, ServiceEntry>();
  private readonly hookRetryAttempts = 1;

  /**
   * Lists all ready service names.
   */
  public listReadyServices(): ServiceKey[] {
    const readyServices: ServiceKey[] = [];

    this.serviceStore.forEach((entry, serviceName) => {
      if (entry.state === "ready") {
        readyServices.push(serviceName);
      }
    });

    return readyServices;
  }

  /**
   * Lists all waiting service names.
   */
  public listWaitingServices(): ServiceKey[] {
    const waitingServices: ServiceKey[] = [];

    this.serviceStore.forEach((entry, serviceName) => {
      if (entry.state === "waiting") {
        waitingServices.push(serviceName);
      }
    });

    return waitingServices;
  }

  /**
   * Returns waiting and failed services with diagnostic context.
   */
  public getUnresolvedServices(): UnresolvedServiceInfo[] {
    const unresolvedServices: UnresolvedServiceInfo[] = [];

    this.serviceStore.forEach((entry, serviceName) => {
      if (entry.state === "waiting") {
        const cyclePath = this.getCyclePath(serviceName);
        const waitingInfo: WaitingServiceInfo = {
          name: serviceName,
          state: "waiting",
          dependencies: entry.dependencies,
          missingDependencies: this.getMissingDependencies(entry.dependencies),
          ...(cyclePath === undefined ? {} : { cyclePath }),
        };
        unresolvedServices.push(waitingInfo);
        return;
      }

      if (entry.state === "failed") {
        const failedInfo: FailedServiceInfo = {
          name: serviceName,
          state: "failed",
          dependencies: entry.dependencies,
          errorMessage: entry.errorMessage,
          initError: entry.initError,
        };
        unresolvedServices.push(failedInfo);
      }
    });

    return unresolvedServices;
  }

  /**
   * Registers a service manifest and eagerly resolves any now-satisfiable services.
   *
   * @throws Error when a service with the same name is already registered.
   */
  public registerService<K extends ServiceKey, D extends readonly ServiceKey[]>(
    manifest: ServiceManifest<K, D>,
  ): void {
    if (this.serviceStore.has(manifest.name)) {
      throw new Error(`Service '${manifest.name}' is already registered`);
    }

    const waitingEntry: WaitingEntry<K, D> = {
      state: "waiting",
      dependencies: manifest.dependencies,
      hookPolicies: this.toHookPolicyMap(manifest.hooks),
      createInstance: () =>
        manifest.factory(this.buildDependencies(manifest.dependencies)),
    };

    this.serviceStore.set(manifest.name, waitingEntry);

    this.tryResolveAll();
  }

  /**
   * Returns a ready service instance, or `undefined` when not yet resolved.
   *
   * This method does not throw when the service is missing.
   */
  public getServiceUnsafe<K extends ServiceKey>(
    name: K,
  ): Services[K] | undefined {
    const entry = this.getEntry(name);

    if (entry?.state !== "ready") {
      return undefined;
    }

    return entry.instance;
  }

  /**
   * Triggers a lifecycle event on all ready services that declare a hook.
   *
   * Failures are aggregated and returned in the result.
   */
  public async triggerEvent(
    eventName: RegistryEventName,
  ): Promise<TriggerEventResult> {
    const logger = this.getServiceUnsafe("Logger");
    const tasks = this.getHookTasks(eventName);
    const taskCount = String(tasks.length);

    logger?.info(
      "ServiceRegistry",
      `Triggering '${eventName}' for ${taskCount} hook(s)`,
    );

    const settled = await Promise.allSettled(
      tasks.map(async (task) => {
        const { serviceName, hookName } = task;
        await this.runWithLifecyclePolicy(task);
        logger?.debug(
          "ServiceRegistry",
          `Event '${eventName}' completed for service '${serviceName}' via '${hookName}'`,
        );
      }),
    );

    const failures: TriggerEventFailure[] = [];
    const getRejectedReason = (props: { reason: unknown }): unknown => {
      const { reason } = props;

      return reason;
    };

    for (const result of settled) {
      if (result.status === "rejected") {
        const reason = getRejectedReason(result as { reason: unknown });

        if (reason instanceof HookExecutionError) {
          failures.push({
            serviceName: reason.serviceName,
            hookName: reason.hookName,
            eventName,
            timestamp: new Date().toISOString(),
            errorMessage: this.toErrorMessage(reason.causeReason),
            reason: reason.causeReason,
          });
          continue;
        }

        failures.push({
          serviceName: "Unknown",
          hookName: "unknown",
          eventName,
          timestamp: new Date().toISOString(),
          errorMessage: this.toErrorMessage(reason),
          reason,
        });
      }
    }

    if (failures.length > 0) {
      const failureCount = String(failures.length);
      logger?.warn(
        "ServiceRegistry",
        `Event '${eventName}' completed with ${failureCount} failure(s)`,
        failures,
      );
    } else {
      logger?.info(
        "ServiceRegistry",
        `Event '${eventName}' completed successfully`,
      );
    }

    return {
      eventName,
      failures,
    };
  }

  /**
   * Resolves waiting services until no additional progress can be made.
   */
  private tryResolveAll(): void {
    let progress = true;

    while (progress) {
      progress = false;

      this.serviceStore.forEach((entry, name) => {
        if (entry.state !== "waiting") return;

        const depsReady = entry.dependencies.every(
          (dep) => this.serviceStore.get(dep)?.state === "ready",
        );

        if (!depsReady) return;

        let instance: Services[ServiceKey];

        try {
          instance = entry.createInstance();
        } catch (initError: unknown) {
          const failedEntry: FailedEntry = {
            state: "failed",
            dependencies: entry.dependencies,
            initError,
            errorMessage: this.toErrorMessage(initError),
          };
          this.serviceStore.set(name, failedEntry);
          progress = true;
          return;
        }

        let hooks: ReadyHooks;

        try {
          hooks = this.createReadyHooks({
            serviceName: name,
            instance,
            hookPolicies: entry.hookPolicies,
          });
        } catch (initError: unknown) {
          const failedEntry: FailedEntry = {
            state: "failed",
            dependencies: entry.dependencies,
            initError,
            errorMessage: this.toErrorMessage(initError),
          };
          this.serviceStore.set(name, failedEntry);
          progress = true;
          return;
        }

        const readyEntry: ReadyEntry = {
          state: "ready",
          instance,
          hooks,
        };

        this.serviceStore.set(name, readyEntry);

        progress = true;
      });
    }
  }

  /**
   * Builds the dependency object passed to a manifest factory.
   *
   * @throws Error when a declared dependency is not ready.
   */
  private buildDependencies<D extends readonly ServiceKey[]>(
    deps: D,
  ): DependencyRecord<D> {
    const result = {} as DependencyRecord<D>;

    for (const dep of deps) {
      const entry = this.getEntry(dep);

      if (entry?.state !== "ready") {
        throw new Error(`Dependency ${dep} not ready`);
      }

      this.assignDependency(result, dep, entry.instance);
    }

    return result;
  }

  private assignDependency<
    D extends readonly ServiceKey[],
    K extends D[number],
  >(
    result: DependencyRecord<D>,
    dependencyName: K,
    instance: Services[K],
  ): void {
    result[dependencyName] = instance;
  }

  private getEntry<K extends ServiceKey>(name: K): ServiceEntry<K> | undefined {
    return this.serviceStore.get(name) as ServiceEntry<K> | undefined;
  }

  private getMissingDependencies(
    dependencies: readonly ServiceKey[],
  ): readonly ServiceKey[] {
    return dependencies.filter((dependencyName) => {
      const dependencyEntry = this.serviceStore.get(dependencyName);
      return dependencyEntry?.state !== "ready";
    });
  }

  private toErrorMessage(reason: unknown): string {
    if (reason instanceof Error) {
      return reason.message;
    }

    if (typeof reason === "string") {
      return reason;
    }

    return "Unknown error";
  }

  /**
   * Executes a hook task with optional retry policy.
   */
  private async runWithLifecyclePolicy(task: HookTask): Promise<void> {
    const { retry, run, serviceName, hookName } = task;
    const totalAttempts = retry ? this.hookRetryAttempts + 1 : 1;
    let latestReason: unknown;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      try {
        await run();
        return;
      } catch (reason: unknown) {
        latestReason = reason;
      }
    }

    throw new HookExecutionError(serviceName, hookName, latestReason);
  }

  /**
   * Collects executable hook tasks for the given lifecycle event.
   */
  private getHookTasks(eventName: RegistryEventName): HookTask[] {
    const tasks: HookTask[] = [];

    this.serviceStore.forEach((entry, serviceName) => {
      if (entry.state !== "ready") {
        return;
      }

      const readyHook = entry.hooks[eventName];

      if (readyHook === undefined) {
        return;
      }

      const { methodName, run } = readyHook;

      tasks.push({
        serviceName,
        hookName: methodName,
        retry: readyHook.retry,
        run,
      });
    });

    return tasks;
  }

  /**
   * Binds declared hook method names to callable functions on the instance.
   *
   * @throws Error when a declared hook is not a callable method.
   */
  private createReadyHooks(props: CreateReadyHooksProps): ReadyHooks {
    const { serviceName, instance, hookPolicies } = props;
    const hooks: ReadyHooks = {};

    for (const eventName of Object.keys(hookPolicies) as RegistryEventName[]) {
      const policy = hookPolicies[eventName];

      if (policy === undefined) {
        continue;
      }

      const { method: methodName, retry } = policy;

      const candidate = (instance as unknown as Record<string, unknown>)[
        methodName
      ];

      if (typeof candidate !== "function") {
        throw new Error(
          `Hook '${methodName}' is not callable on service '${serviceName}'`,
        );
      }

      const method = candidate as () => Promise<void>;
      hooks[eventName] = {
        methodName,
        retry,
        run: () => method.call(instance),
      };
    }

    return hooks;
  }

  /**
   * Normalizes optional manifest hooks into lifecycle policies.
   */
  private toHookPolicyMap<K extends ServiceKey>(
    hooks: ServiceHooks<K> | undefined,
  ): HookPolicyMap {
    const hookPolicyMap: HookPolicyMap = {};

    if (hooks === undefined) {
      return hookPolicyMap;
    }

    for (const eventName of Object.keys(hooks) as RegistryEventName[]) {
      const policy = hooks[eventName];

      if (policy !== undefined) {
        hookPolicyMap[eventName] = this.validateHookPolicy(policy);
      }
    }

    return hookPolicyMap;
  }

  private validateHookPolicy(
    policy: LifecycleHookPolicy,
  ): ResolvedLifecycleHookPolicy {
    const { method, retry } = policy;

    return {
      method,
      retry: retry ?? false,
    };
  }

  private getCyclePath(
    startServiceName: ServiceKey,
  ): readonly ServiceKey[] | undefined {
    return this.findCycleFrom(startServiceName, []);
  }

  private findCycleFrom(
    serviceName: ServiceKey,
    path: readonly ServiceKey[],
  ): ServiceKey[] | undefined {
    const entry = this.serviceStore.get(serviceName);

    if (entry?.state !== "waiting") {
      return undefined;
    }

    const currentPath = [...path, serviceName];

    for (const dependencyName of entry.dependencies) {
      const dependencyEntry = this.serviceStore.get(dependencyName);

      if (dependencyEntry?.state !== "waiting") {
        continue;
      }

      const cycleStartIndex = currentPath.indexOf(dependencyName);

      if (cycleStartIndex !== -1) {
        return [...currentPath.slice(cycleStartIndex), dependencyName];
      }

      const cyclePath = this.findCycleFrom(dependencyName, currentPath);

      if (cyclePath !== undefined) {
        return cyclePath;
      }
    }

    return undefined;
  }
}
