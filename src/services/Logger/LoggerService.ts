import type { Service } from "../Service";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerService extends Service {
  log: (logLevel: LogLevel, scope: string, ...args: unknown[]) => void;
  debug: (scope: string, ...args: unknown[]) => void;
  info: (scope: string, ...args: unknown[]) => void;
  warn: (scope: string, ...args: unknown[]) => void;
  error: (scope: string, ...args: unknown[]) => void;
}
