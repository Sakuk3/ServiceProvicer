import type { ServiceKey } from "../serviceTypes";
import { ServiceRegistryError } from "./ServiceRegistryError";

export class ServiceDependencyNotReadyError extends ServiceRegistryError {
  public readonly dependencyName: ServiceKey;

  public constructor(dependencyName: ServiceKey) {
    super(`Dependency ${dependencyName} not ready`);
    this.name = "ServiceDependencyNotReadyError";
    this.dependencyName = dependencyName;
  }
}
