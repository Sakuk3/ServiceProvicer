import { defineService } from "../../registry";
import { BasicStorageService } from "./BasicStorageService";

const serviceName = "Storage";

export const storageManifest = defineService({
  name: serviceName,
  description: "Storage service",
  dependencies: ["Logger"],
  factory: (deps) => {
    const { Logger } = deps;
    console.log(`[${serviceName}] using ${Logger.name}`);
    return new BasicStorageService(serviceName);
  },
});
