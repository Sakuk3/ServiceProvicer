import { defineService } from "../../registry";
import { BasicLoggerService } from "./BasicLoggerService";

const serviceName = "Logger" as const;

export const loggerManifest = defineService({
  name: serviceName,
  description: "Application logger",
  dependencies: [] as const,
  factory: (deps) => {
    const { ...resolvedDeps } = deps;
    void resolvedDeps;
    return new BasicLoggerService(serviceName);
  },
});
