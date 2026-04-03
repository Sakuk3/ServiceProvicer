import type { ServiceKey } from "../serviceTypes";
import { ServiceRegistryError } from "./ServiceRegistryError";

export class ServiceHookNotCallableError extends ServiceRegistryError {
  public readonly serviceName: ServiceKey;
  public readonly hookName: string;

  public constructor(serviceName: ServiceKey, hookName: string) {
    super(`Hook '${hookName}' is not callable on service '${serviceName}'`);
    this.name = "ServiceHookNotCallableError";
    this.serviceName = serviceName;
    this.hookName = hookName;
  }
}
