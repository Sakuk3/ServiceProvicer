import { ServiceKey, Services } from "./serviceTypes";
import {
  CreateReadyHooksProps,
  DependencyRecord,
  HookExecutionError,
  HookMethodMap,
  HookTask,
  ReadyEntry,
  ReadyHooks,
  RegistryEventName,
  ServiceEntry,
  TriggerEventFailure,
  TriggerEventResult,
  WaitingEntry,
} from "./types";
import type { ServiceHooks, ServiceManifest } from "./manifest";

/**
 * Registers service manifests, resolves dependencies, and executes lifecycle hooks.
 */
export class ServiceRegistry {
  private readonly serviceStore = new Map<ServiceKey, ServiceEntry>();

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

    const waitingEntry: WaitingEntry = {
      state: "waiting",
      dependencies: manifest.dependencies,
      hookMethods: this.toHookMethodMap(manifest.hooks),
      createInstance: () =>
        manifest.factory(
          this.buildDependencies(manifest.dependencies),
        ) as Services[ServiceKey],
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
    const entry = this.serviceStore.get(name);
    return entry?.state === "ready"
      ? (entry.instance as Services[K])
      : undefined;
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
        const { serviceName, hookName, run } = task;
        await run();
        logger?.debug(
          "ServiceRegistry",
          `Event '${eventName}' completed for service '${serviceName}' via '${hookName}'`,
        );
      }),
    );

    const failures: TriggerEventFailure[] = [];

    for (const result of settled) {
      if (result.status === "rejected") {
        const reason: unknown = result.reason;

        if (reason instanceof HookExecutionError) {
          failures.push({
            serviceName: reason.serviceName,
            hookName: reason.hookName,
            reason: reason.causeReason,
          });
          continue;
        }

        failures.push({
          serviceName: "Unknown",
          hookName: "unknown",
          reason,
        });
      }
    }

    // Future improvement: add configurable retry policies per event/hook.
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

        const instance = entry.createInstance();

        const readyEntry: ReadyEntry = {
          state: "ready",
          instance,
          hooks: this.createReadyHooks({
            serviceName: name,
            instance,
            hookMethods: entry.hookMethods,
          }),
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
      const entry = this.serviceStore.get(dep);

      if (entry?.state !== "ready") {
        throw new Error(`Dependency ${dep} not ready`);
      }

      (result as Record<ServiceKey, Services[ServiceKey]>)[dep] =
        entry.instance;
    }

    return result;
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
        run: async () => {
          try {
            await run();
          } catch (reason: unknown) {
            throw new HookExecutionError(serviceName, methodName, reason);
          }
        },
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
    const { serviceName, instance, hookMethods } = props;
    const hooks: ReadyHooks = {};

    for (const eventName of Object.keys(hookMethods) as RegistryEventName[]) {
      const methodName = hookMethods[eventName];

      if (methodName === undefined) {
        continue;
      }

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
        run: () => method.call(instance),
      };
    }

    return hooks;
  }

  /**
   * Normalizes optional manifest hooks into a plain event to method map.
   */
  private toHookMethodMap<K extends ServiceKey>(
    hooks: ServiceHooks<K> | undefined,
  ): HookMethodMap {
    const hookMethodMap: HookMethodMap = {};

    if (hooks === undefined) {
      return hookMethodMap;
    }

    for (const eventName of Object.keys(hooks) as RegistryEventName[]) {
      const methodName = hooks[eventName];

      if (methodName !== undefined) {
        hookMethodMap[eventName] = methodName;
      }
    }

    return hookMethodMap;
  }
}
