import { AbstractService } from "./AbstractService";
import { defineService } from "../registry";

export class StorageService extends AbstractService {
  readonly name = "Storage";
}

export const storageManifest = defineService({
  name: "Storage",
  description: "Storage service",
  dependencies: ["Logger"] as const,
  factory: (deps) => {
    const { Logger } = deps
    console.log(`[Storage] using ${Logger.name}`);
    return new StorageService();
  },
});

