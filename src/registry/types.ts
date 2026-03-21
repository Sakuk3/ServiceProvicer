import type { ServiceKey, Services } from "./serviceTypes";

export type DependencyRecord<D extends readonly ServiceKey[]> = {
  [P in D[number]]: Services[P];
};

export type RegistryEventName = "login" | "logout";

export interface TriggerEventFailure {
  serviceName: ServiceKey | "Unknown";
  hookName: string;
  eventName: RegistryEventName;
  timestamp: string;
  errorMessage: string;
  reason: unknown;
}

export interface TriggerEventResult {
  eventName: RegistryEventName;
  failures: readonly TriggerEventFailure[];
}

export interface HookTask {
  serviceName: ServiceKey;
  hookName: string;
  retry: boolean;
  run: () => Promise<void>;
}

export interface LifecycleHookPolicy {
  method: string;
  retry?: boolean;
}

export interface ResolvedLifecycleHookPolicy {
  method: string;
  retry: boolean;
}

export interface ReadyHook {
  methodName: string;
  retry: boolean;
  run: () => Promise<void>;
}

export type ReadyHooks = Partial<Record<RegistryEventName, ReadyHook>>;
export type HookPolicyMap = Partial<
  Record<RegistryEventName, ResolvedLifecycleHookPolicy>
>;

export interface WaitingEntry {
  state: "waiting";
  dependencies: readonly ServiceKey[];
  hookPolicies: HookPolicyMap;
  createInstance: () => Services[ServiceKey];
}

export interface ReadyEntry {
  state: "ready";
  hooks: ReadyHooks;
  instance: Services[ServiceKey];
}

export interface FailedEntry {
  state: "failed";
  dependencies: readonly ServiceKey[];
  initError: unknown;
  errorMessage: string;
}

export type ServiceEntry = WaitingEntry | ReadyEntry | FailedEntry;

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

export interface CreateReadyHooksProps {
  serviceName: ServiceKey;
  instance: Services[ServiceKey];
  hookPolicies: HookPolicyMap;
}

export class HookExecutionError extends Error {
  public constructor(
    public readonly serviceName: ServiceKey,
    public readonly hookName: string,
    public readonly causeReason: unknown,
  ) {
    super(`Hook '${hookName}' failed for service '${serviceName}'`);
  }
}
