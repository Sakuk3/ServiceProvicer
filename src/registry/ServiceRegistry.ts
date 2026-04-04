import type { ServiceKey, Services } from "./serviceTypes";
import type {
  CreateReadyHooksProps,
  DependencyRecord,
  ServiceDependencyGraph,
  ReadyHooks,
  RegistryEvent,
  RegistryEventName,
  ServiceEntry,
  TriggerEventResult,
  UnresolvedServiceInfo,
  WaitingEntry,
} from "./types";
import {
  ServiceAlreadyRegisteredError,
  ServiceDependencyNotReadyError,
  ServiceHookNotCallableError,
  ServiceRegistryCircularDependencyError,
} from "./errors";
import type { ServiceManifest } from "./manifest";
import {
  BaseDependencyGraphBehavior,
  BaseHookOrchestration,
  BaseHookPolicyNormalization,
  BaseWaitingEntryResolution,
  type DependencyGraphBehavior,
  type HookOrchestration,
  type HookPolicyNormalization,
  type WaitingEntryResolution,
} from "./behaviors";
import { findWaitingCyclePath } from "./utils/cycleDetection";
import { toUnresolvedServiceInfo } from "./utils/serviceEntryDiagnostics";

/**
 * Registers service manifests, resolves dependencies, and executes lifecycle hooks.
 */
export class ServiceRegistry {
  private readonly entriesByService = new Map<ServiceKey, ServiceEntry>();
  private readonly hookOrchestration: HookOrchestration;
  private readonly waitingEntryResolution: WaitingEntryResolution;
  private readonly hookPolicyNormalization: HookPolicyNormalization;
  private readonly dependencyGraphBehavior: DependencyGraphBehavior;

  public constructor(
    props: {
      hookOrchestration?: HookOrchestration;
      waitingEntryResolution?: WaitingEntryResolution;
      hookPolicyNormalization?: HookPolicyNormalization;
      dependencyGraphBehavior?: DependencyGraphBehavior;
    } = {},
  ) {
    const {
      hookOrchestration = new BaseHookOrchestration({ hookRetryAttempts: 1 }),
      waitingEntryResolution = new BaseWaitingEntryResolution(),
      hookPolicyNormalization = new BaseHookPolicyNormalization(),
      dependencyGraphBehavior = new BaseDependencyGraphBehavior(),
    } = props;

    this.hookOrchestration = hookOrchestration;
    this.waitingEntryResolution = waitingEntryResolution;
    this.hookPolicyNormalization = hookPolicyNormalization;
    this.dependencyGraphBehavior = dependencyGraphBehavior;
  }

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
      const unresolvedService = toUnresolvedServiceInfo({
        entriesByService: this.entriesByService,
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
    return this.dependencyGraphBehavior.buildDependencyGraph({
      entriesByService: this.entriesByService,
    });
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
      hookPolicies: this.hookPolicyNormalization.normalizeHookPolicies({
        hooks,
      }),
      createInstance: () => factory(this.buildDependencies(dependencies)),
    };

    this.entriesByService.set(name, waitingEntry);

    const cyclePath = findWaitingCyclePath({
      entriesByService: this.entriesByService,
      startServiceName: name,
    });

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
    return this.hookOrchestration.triggerEvent({
      entriesByService: this.entriesByService,
      event,
    });
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

        if (
          !this.waitingEntryResolution.canResolveWaitingEntry({
            entriesByService: this.entriesByService,
            entry,
          })
        ) {
          return;
        }

        const resolvedEntry = this.waitingEntryResolution.resolveWaitingEntry({
          serviceName,
          entry,
          createReadyHooks: (createReadyHooksProps) =>
            this.createReadyHooks(createReadyHooksProps),
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

  private listServicesByState(state: "ready" | "waiting"): ServiceKey[] {
    const serviceNames: ServiceKey[] = [];

    this.entriesByService.forEach((entry, serviceName) => {
      if (entry.state === state) {
        serviceNames.push(serviceName);
      }
    });

    return serviceNames;
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
}
