import type { ServiceKey, Services } from "./serviceTypes";

export type DependencyRecord<D extends readonly ServiceKey[]> = {
  [P in D[number]]: Services[P];
};

export type RegistryEventName = "login" | "logout";

export interface TriggerEventFailure {
  serviceName: ServiceKey | "Unknown";
  hookName: string;
  reason: unknown;
}

export interface TriggerEventResult {
  eventName: RegistryEventName;
  failures: readonly TriggerEventFailure[];
}

export interface HookTask {
  serviceName: ServiceKey;
  hookName: string;
  run: () => Promise<void>;
}

export interface ReadyHook {
  methodName: string;
  run: () => Promise<void>;
}

export type ReadyHooks = Partial<Record<RegistryEventName, ReadyHook>>;
export type HookMethodMap = Partial<Record<RegistryEventName, string>>;

export interface WaitingEntry {
  state: "waiting";
  dependencies: readonly ServiceKey[];
  hookMethods: HookMethodMap;
  createInstance: () => Services[ServiceKey];
}

export interface ReadyEntry {
  state: "ready";
  hooks: ReadyHooks;
  instance: Services[ServiceKey];
}

export type ServiceEntry = WaitingEntry | ReadyEntry;

export interface CreateReadyHooksProps {
  serviceName: ServiceKey;
  instance: Services[ServiceKey];
  hookMethods: HookMethodMap;
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
