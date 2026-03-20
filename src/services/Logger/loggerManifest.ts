import { defineService } from "../../registry";
import { BasicLoggerService } from "./BasicLoggerService";
import type { LogLevel } from "./LoggerService";

const serviceName = "Logger" as const;
const minLogLevel: LogLevel = "debug";

export const loggerManifest = defineService({
  name: serviceName,
  description: "Application logger",
  dependencies: [] as const,
  factory: (deps) => {
    const { ...resolvedDeps } = deps;
    void resolvedDeps;
    return new BasicLoggerService(serviceName, minLogLevel);
  },
});
