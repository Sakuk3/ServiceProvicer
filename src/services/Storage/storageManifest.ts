import { defineService } from "../../registry";
import { BasicStorageService } from "./BasicStorageService";

const serviceName = "Storage";

export const storageManifest = defineService({
  name: serviceName,
  description: "Storage service",
  dependencies: ["Logger"],
  hooks: {
    login: { method: "handleLogin", retry: true },
    logout: { method: "handleLogout" },
  },
  factory: (deps) => {
    const { Logger } = deps;
    return new BasicStorageService(serviceName, Logger);
  },
});
