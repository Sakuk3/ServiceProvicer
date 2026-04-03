import type { ServiceKey } from "../serviceTypes";
import { ServiceRegistryError } from "./ServiceRegistryError";

export class ServiceManifestDuplicateDependenciesError extends ServiceRegistryError {
  public readonly serviceName: ServiceKey;
  public readonly duplicateDependencies: readonly ServiceKey[];

  public constructor(
    serviceName: ServiceKey,
    duplicateDependencies: readonly ServiceKey[],
  ) {
    super(
      `Service '${serviceName}' has duplicate dependencies: ${duplicateDependencies.join(", ")}`,
    );
    this.name = "ServiceManifestDuplicateDependenciesError";
    this.serviceName = serviceName;
    this.duplicateDependencies = duplicateDependencies;
  }
}
