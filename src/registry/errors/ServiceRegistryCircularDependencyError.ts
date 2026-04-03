import type { ServiceKey } from "../serviceTypes";
import { ServiceRegistryError } from "./ServiceRegistryError";

export class ServiceRegistryCircularDependencyError extends ServiceRegistryError {
  public readonly cyclePath: readonly ServiceKey[];

  public constructor(cyclePath: readonly ServiceKey[]) {
    super(`Circular dependency detected: ${cyclePath.join(" -> ")}`);
    this.name = "ServiceRegistryCircularDependencyError";
    this.cyclePath = cyclePath;
  }
}
