import type { LogLevel, LoggerService } from "./LoggerService";

export interface ScopedLogger {
  log: (logLevel: LogLevel, ...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export const scopedLoggerFactory = (
  loggerService: LoggerService,
  scope: string,
): ScopedLogger => {
  return {
    log: (logLevel, ...args) => {
      loggerService.log(logLevel, scope, ...args);
    },
    debug: (...args) => {
      loggerService.debug(scope, ...args);
    },
    info: (...args) => {
      loggerService.info(scope, ...args);
    },
    warn: (...args) => {
      loggerService.warn(scope, ...args);
    },
    error: (...args) => {
      loggerService.error(scope, ...args);
    },
  };
};
