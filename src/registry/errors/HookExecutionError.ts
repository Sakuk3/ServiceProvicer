import type { ServiceKey } from "../serviceTypes";
import { ServiceRegistryError } from "./ServiceRegistryError";

export class HookExecutionError extends ServiceRegistryError {
  public readonly serviceName: ServiceKey;
  public readonly hookName: string;
  public readonly causeReason: unknown;

  public constructor(
    serviceName: ServiceKey,
    hookName: string,
    causeReason: unknown,
  ) {
    super(`Hook '${hookName}' failed for service '${serviceName}'`);
    this.name = "HookExecutionError";
    this.serviceName = serviceName;
    this.hookName = hookName;
    this.causeReason = causeReason;
  }
}
