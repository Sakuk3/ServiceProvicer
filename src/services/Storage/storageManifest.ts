import { defineService } from "../../registry";
import { BasicStorageService } from "./BasicStorageService";

const serviceName = "Storage" as const;

export const storageManifest = defineService({
  name: serviceName,
  description: "Storage service",
  dependencies: ["Logger"] as const,
  factory: (deps) => {
    const { Logger } = deps;
    console.log(`[${serviceName}] using ${Logger.name}`);
    return new BasicStorageService(serviceName);
  },
});
