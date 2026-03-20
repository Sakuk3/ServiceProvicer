import { AbstractService } from "./AbstractService";
import { defineService } from "../registry";

export class NetworkService extends AbstractService {
  readonly name = "Network";
}

export const networkManifest = defineService({
  name: "Network",
  description: "Network service",
  dependencies: ["Logger", "Storage"] as const,
  factory: (deps) => {
    const { Logger, Storage } = deps
    console.log(`[Network] using ${Logger.name} and ${Storage.name}`);
    return new NetworkService();
  },
});

