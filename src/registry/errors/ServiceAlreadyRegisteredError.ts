import type { ServiceKey } from "../serviceTypes";
import { ServiceRegistryError } from "./ServiceRegistryError";

export class ServiceAlreadyRegisteredError extends ServiceRegistryError {
  public readonly serviceName: ServiceKey;

  public constructor(serviceName: ServiceKey) {
    super(`Service '${serviceName}' is already registered`);
    this.name = "ServiceAlreadyRegisteredError";
    this.serviceName = serviceName;
  }
}
