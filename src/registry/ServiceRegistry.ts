import type { ServiceKey, Services } from "./serviceTypes";
import type {
  CreateReadyHooksProps,
  DependencyRecord,
  FailedEntry,
  HookPolicyMap,
  HookTask,
  LifecycleHookPolicy,
  ResolvedLifecycleHookPolicy,
  ServiceDependencyGraph,
  ServiceDependencyGraphEdge,
  ServiceDependencyGraphNode,
  ReadyEntry,
  ReadyHooks,
  RegistryEvent,
  RegistryEventName,
  RegistryEventPayload,
  ServiceEntry,
  TriggerEventFailure,
  TriggerEventResult,
  UnresolvedServiceInfo,
  WaitingEntry,
} from "./types";
import {
  HookExecutionError,
  ServiceAlreadyRegisteredError,
  ServiceDependencyNotReadyError,
  ServiceHookNotCallableError,
  ServiceRegistryCircularDependencyError,
} from "./errors";
import type { ServiceHooks, ServiceManifest } from "./manifest";

/**
 * Registers service manifests, resolves dependencies, and executes lifecycle hooks.
 */
export class ServiceRegistry {
  private readonly entriesByService = new Map<ServiceKey, ServiceEntry>();
  private readonly hookRetryAttempts = 1;

  /**
   * Lists all ready service names.
   */
  public listReadyServices(): ServiceKey[] {
    return this.listServicesByState("ready");
  }

  /**
   * Lists all waiting service names.
   */
  public listWaitingServices(): ServiceKey[] {
    return this.listServicesByState("waiting");
  }

  /**
   * Returns waiting and failed services with diagnostic context.
   */
  public getUnresolvedServices(): UnresolvedServiceInfo[] {
    const unresolvedServices: UnresolvedServiceInfo[] = [];

    this.entriesByService.forEach((entry, serviceName) => {
      const unresolvedService = this.toUnresolvedServiceInfo({
        serviceName,
        entry,
      });

      if (unresolvedService !== undefined) {
        unresolvedServices.push(unresolvedService);
      }
    });

    return unresolvedServices;
  }

  /**
   * Returns a structured dependency graph of all registered services.
   */
  public getDependencyGraph(): ServiceDependencyGraph {
    const nodes: ServiceDependencyGraphNode[] = [];
    const edges: ServiceDependencyGraphEdge[] = [];

    this.entriesByService.forEach((entry, serviceName) => {
      const { dependencies } = entry;

      nodes.push({
        name: serviceName,
        state: entry.state,
        dependencies,
        missingDependencies: this.getMissingDependencies(dependencies),
      });

      dependencies.forEach((dependencyName) => {
        const dependencyEntry = this.entriesByService.get(dependencyName);

        edges.push({
          from: serviceName,
          to: dependencyName,
          isRegistered: dependencyEntry !== undefined,
          isReady: dependencyEntry?.state === "ready",
        });
      });
    });

    return {
      nodes,
      edges,
    };
  }

  /**
   * Registers a service manifest and eagerly resolves any now-satisfiable services.
   *
   * @throws Error when a service with the same name is already registered.
   */
  public registerService<K extends ServiceKey, D extends readonly ServiceKey[]>(
    manifest: ServiceManifest<K, D>,
  ): void {
    const { name, dependencies, hooks, factory } = manifest;

    if (this.entriesByService.has(name)) {
      throw new ServiceAlreadyRegisteredError(name);
    }

    const waitingEntry: WaitingEntry<K, D> = {
      state: "waiting",
      dependencies,
      hookPolicies: this.normalizeHookPolicies(hooks),
      createInstance: () => factory(this.buildDependencies(dependencies)),
    };

    this.entriesByService.set(name, waitingEntry);

    const cyclePath = this.getCyclePath(name);

    if (cyclePath !== undefined) {
      // Keep registration atomic when the new manifest introduces a cycle.
      this.entriesByService.delete(name);
      throw new ServiceRegistryCircularDependencyError(cyclePath);
    }

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
  public async triggerEvent<E extends RegistryEventName>(
    event: RegistryEvent<E>,
  ): Promise<TriggerEventResult<E>> {
    const { name: eventName, payload } = event;
    const logger = this.getServiceUnsafe("Logger");
    const tasks = this.getHookTasks(eventName);
    this.logTriggerStart({ logger, eventName, taskCount: tasks.length });

    const settled = await this.executeHookTasks({
      logger,
      eventName,
      payload,
      tasks,
    });
    const failures = this.collectTriggerFailures({ eventName, settled });

    this.logTriggerSummary({ logger, eventName, failures });

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

      this.entriesByService.forEach((entry, serviceName) => {
        if (entry.state !== "waiting") {
          return;
        }

        if (!this.canResolveWaitingEntry(entry)) {
          return;
        }

        const resolvedEntry = this.resolveWaitingEntry({
          serviceName,
          entry,
        });

        this.entriesByService.set(serviceName, resolvedEntry);

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

    for (const dependencyName of deps) {
      const entry = this.getEntry(dependencyName);

      if (entry?.state !== "ready") {
        throw new ServiceDependencyNotReadyError(dependencyName);
      }

      this.assignDependency({
        result,
        dependencyName,
        instance: entry.instance,
      });
    }

    return result;
  }

  private assignDependency<
    D extends readonly ServiceKey[],
    K extends D[number],
  >(props: {
    result: DependencyRecord<D>;
    dependencyName: K;
    instance: Services[K];
  }): void {
    const { result, dependencyName, instance } = props;

    result[dependencyName] = instance;
  }

  private getEntry<K extends ServiceKey>(name: K): ServiceEntry<K> | undefined {
    return this.entriesByService.get(name) as ServiceEntry<K> | undefined;
  }

  private getMissingDependencies(
    dependencies: readonly ServiceKey[],
  ): readonly ServiceKey[] {
    return dependencies.filter((dependencyName) => {
      const dependencyEntry = this.entriesByService.get(dependencyName);
      return dependencyEntry?.state !== "ready";
    });
  }

  private listServicesByState(state: "ready" | "waiting"): ServiceKey[] {
    const serviceNames: ServiceKey[] = [];

    this.entriesByService.forEach((entry, serviceName) => {
      if (entry.state === state) {
        serviceNames.push(serviceName);
      }
    });

    return serviceNames;
  }

  private toUnresolvedServiceInfo(props: {
    serviceName: ServiceKey;
    entry: ServiceEntry;
  }): UnresolvedServiceInfo | undefined {
    const { serviceName, entry } = props;

    if (entry.state === "waiting") {
      const cyclePath = this.getCyclePath(serviceName);

      return {
        name: serviceName,
        state: "waiting",
        dependencies: entry.dependencies,
        missingDependencies: this.getMissingDependencies(entry.dependencies),
        ...(cyclePath === undefined ? {} : { cyclePath }),
      };
    }

    if (entry.state === "failed") {
      return {
        name: serviceName,
        state: "failed",
        dependencies: entry.dependencies,
        errorMessage: entry.errorMessage,
        initError: entry.initError,
      };
    }

    return undefined;
  }

  private canResolveWaitingEntry(entry: WaitingEntry): boolean {
    return entry.dependencies.every(
      (dependencyName) =>
        this.entriesByService.get(dependencyName)?.state === "ready",
    );
  }

  private resolveWaitingEntry(props: {
    serviceName: ServiceKey;
    entry: WaitingEntry;
  }): ReadyEntry | FailedEntry {
    const { serviceName, entry } = props;

    try {
      const instance = entry.createInstance();
      const hooks = this.createReadyHooks({
        serviceName,
        instance,
        hookPolicies: entry.hookPolicies,
      });

      return {
        state: "ready",
        dependencies: entry.dependencies,
        instance,
        hooks,
      };
    } catch (initError: unknown) {
      return this.toFailedEntry({
        dependencies: entry.dependencies,
        initError,
      });
    }
  }

  private toFailedEntry(props: {
    dependencies: readonly ServiceKey[];
    initError: unknown;
  }): FailedEntry {
    const { dependencies, initError } = props;

    return {
      state: "failed",
      dependencies,
      initError,
      errorMessage: this.toErrorMessage(initError),
    };
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
  private async runWithLifecyclePolicy<E extends RegistryEventName>(props: {
    task: HookTask<E>;
    payload: RegistryEventPayload<E> | undefined;
  }): Promise<void> {
    const { task, payload } = props;
    const { retry, run, serviceName, hookName } = task;
    const totalAttempts = retry ? this.hookRetryAttempts + 1 : 1;
    let latestReason: unknown;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      try {
        await run(payload);
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
  private getHookTasks<E extends RegistryEventName>(
    eventName: E,
  ): HookTask<E>[] {
    const tasks: HookTask<E>[] = [];

    this.entriesByService.forEach((entry, serviceName) => {
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
        eventName,
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
        throw new ServiceHookNotCallableError(serviceName, methodName);
      }

      const method = candidate as (...args: unknown[]) => Promise<void>;
      hooks[eventName] = {
        methodName,
        retry,
        run: (payload) => {
          if (payload === undefined) {
            return method.call(instance);
          }

          return method.call(instance, payload);
        },
      };
    }

    return hooks;
  }

  /**
   * Normalizes optional manifest hooks into lifecycle policies.
   */
  private normalizeHookPolicies<K extends ServiceKey>(
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

  private logTriggerStart(props: {
    logger: Services["Logger"] | undefined;
    eventName: RegistryEventName;
    taskCount: number;
  }): void {
    const { logger, eventName, taskCount } = props;

    logger?.info(
      "ServiceRegistry",
      `Triggering '${eventName}' for ${String(taskCount)} hook(s)`,
    );
  }

  private async executeHookTasks<E extends RegistryEventName>(props: {
    logger: Services["Logger"] | undefined;
    eventName: E;
    payload: RegistryEventPayload<E> | undefined;
    tasks: readonly HookTask<E>[];
  }): Promise<PromiseSettledResult<void>[]> {
    const { logger, eventName, payload, tasks } = props;

    return Promise.allSettled(
      tasks.map(async (task) => {
        const { serviceName, hookName } = task;

        await this.runWithLifecyclePolicy({ task, payload });
        logger?.debug(
          "ServiceRegistry",
          `Event '${eventName}' completed for service '${serviceName}' via '${hookName}'`,
        );
      }),
    );
  }

  private collectTriggerFailures<E extends RegistryEventName>(props: {
    eventName: E;
    settled: readonly PromiseSettledResult<void>[];
  }): TriggerEventFailure<E>[] {
    const { eventName, settled } = props;
    const failures: TriggerEventFailure<E>[] = [];

    for (const result of settled) {
      if (result.status !== "rejected") {
        continue;
      }

      failures.push(
        this.toTriggerFailure({
          eventName,
          reason: result.reason,
        }),
      );
    }

    return failures;
  }

  private toTriggerFailure<E extends RegistryEventName>(props: {
    eventName: E;
    reason: unknown;
  }): TriggerEventFailure<E> {
    const { eventName, reason } = props;

    if (reason instanceof HookExecutionError) {
      return {
        serviceName: reason.serviceName,
        hookName: reason.hookName,
        eventName,
        timestamp: new Date().toISOString(),
        errorMessage: this.toErrorMessage(reason.causeReason),
        reason: reason.causeReason,
      };
    }

    return {
      serviceName: "Unknown",
      hookName: "unknown",
      eventName,
      timestamp: new Date().toISOString(),
      errorMessage: this.toErrorMessage(reason),
      reason,
    };
  }

  private logTriggerSummary(props: {
    logger: Services["Logger"] | undefined;
    eventName: RegistryEventName;
    failures: readonly TriggerEventFailure[];
  }): void {
    const { logger, eventName, failures } = props;

    if (failures.length === 0) {
      logger?.info(
        "ServiceRegistry",
        `Event '${eventName}' completed successfully`,
      );
      return;
    }

    logger?.warn(
      "ServiceRegistry",
      `Event '${eventName}' completed with ${String(failures.length)} failure(s)`,
      failures,
    );
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
    return this.findWaitingCyclePath(startServiceName, []);
  }

  private findWaitingCyclePath(
    serviceName: ServiceKey,
    path: readonly ServiceKey[],
  ): ServiceKey[] | undefined {
    const entry = this.entriesByService.get(serviceName);

    if (entry?.state !== "waiting") {
      return undefined;
    }

    const currentPath = [...path, serviceName];

    for (const dependencyName of entry.dependencies) {
      const dependencyEntry = this.entriesByService.get(dependencyName);

      if (dependencyEntry?.state !== "waiting") {
        continue;
      }

      const cycleStartIndex = currentPath.indexOf(dependencyName);

      if (cycleStartIndex !== -1) {
        return [...currentPath.slice(cycleStartIndex), dependencyName];
      }

      const cyclePath = this.findWaitingCyclePath(dependencyName, currentPath);

      if (cyclePath !== undefined) {
        return cyclePath;
      }
    }

    return undefined;
  }
}
