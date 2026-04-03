export class ServiceRegistryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ServiceRegistryError";
  }
}
