import { defineService } from "../../registry";
import { BasicLoggerService } from "./BasicLoggerService";
import type { LogLevel } from "./LoggerService";

const serviceName = "Logger";
const minLogLevel: LogLevel = "debug";

export const loggerManifest = defineService({
  name: serviceName,
  dependencies: [],
  factory: () => {
    return new BasicLoggerService(serviceName, minLogLevel);
  },
});
