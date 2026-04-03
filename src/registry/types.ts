import type { ServiceKey, Services } from "./serviceTypes";
import type { RegistryEvents } from "./registryEventTypes";

export type DependencyRecord<D extends readonly ServiceKey[]> = {
  [P in D[number]]: Services[P];
};

export type RegistryEventName = keyof RegistryEvents;
export type RegistryEventPayload<E extends RegistryEventName> =
  RegistryEvents[E];
export type RegistryEvent<E extends RegistryEventName = RegistryEventName> =
  RegistryEventPayload<E> extends undefined
    ? {
        name: E;
        payload?: RegistryEventPayload<E>;
      }
    : {
        name: E;
        payload: RegistryEventPayload<E>;
      };
export type RegistryHookHandler<E extends RegistryEventName> =
  RegistryEventPayload<E> extends undefined
    ? () => Promise<void>
    : (payload: RegistryEventPayload<E>) => Promise<void>;

export interface TriggerEventFailure<
  E extends RegistryEventName = RegistryEventName,
> {
  serviceName: ServiceKey | "Unknown";
  hookName: string;
  eventName: E;
  timestamp: string;
  errorMessage: string;
  reason: unknown;
}

export interface TriggerEventResult<
  E extends RegistryEventName = RegistryEventName,
> {
  eventName: E;
  failures: readonly TriggerEventFailure<E>[];
}

export interface HookTask<E extends RegistryEventName = RegistryEventName> {
  serviceName: ServiceKey;
  hookName: string;
  eventName: E;
  retry: boolean;
  run: (payload?: RegistryEventPayload<E>) => Promise<void>;
}

export interface LifecycleHookPolicy {
  method: string;
  retry?: boolean;
}

export interface ResolvedLifecycleHookPolicy {
  method: string;
  retry: boolean;
}

export interface ReadyHook<E extends RegistryEventName = RegistryEventName> {
  methodName: string;
  retry: boolean;
  run: (payload?: RegistryEventPayload<E>) => Promise<void>;
}

export type ReadyHooks = {
  [E in RegistryEventName]?: ReadyHook<E>;
};
export type HookPolicyMap = Partial<
  Record<RegistryEventName, ResolvedLifecycleHookPolicy>
>;

export interface WaitingEntry<
  K extends ServiceKey = ServiceKey,
  D extends readonly ServiceKey[] = readonly ServiceKey[],
> {
  state: "waiting";
  dependencies: D;
  hookPolicies: HookPolicyMap;
  createInstance: () => Services[K];
}

export interface ReadyEntry<K extends ServiceKey = ServiceKey> {
  state: "ready";
  hooks: ReadyHooks;
  instance: Services[K];
}

export interface FailedEntry {
  state: "failed";
  dependencies: readonly ServiceKey[];
  initError: unknown;
  errorMessage: string;
}

export type ServiceEntry<
  K extends ServiceKey = ServiceKey,
  D extends readonly ServiceKey[] = readonly ServiceKey[],
> = WaitingEntry<K, D> | ReadyEntry<K> | FailedEntry;

export interface WaitingServiceInfo {
  name: ServiceKey;
  state: "waiting";
  dependencies: readonly ServiceKey[];
  missingDependencies: readonly ServiceKey[];
  cyclePath?: readonly ServiceKey[];
}

export interface FailedServiceInfo {
  name: ServiceKey;
  state: "failed";
  dependencies: readonly ServiceKey[];
  errorMessage: string;
  initError: unknown;
}

export type UnresolvedServiceInfo = WaitingServiceInfo | FailedServiceInfo;

export interface CreateReadyHooksProps<K extends ServiceKey = ServiceKey> {
  serviceName: K;
  instance: Services[K];
  hookPolicies: HookPolicyMap;
}
