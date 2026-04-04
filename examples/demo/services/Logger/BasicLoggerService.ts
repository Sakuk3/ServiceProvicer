import { AbstractService } from "../../../../src";
import type { LogLevel, LoggerService } from "./LoggerService";

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_WRITER: Readonly<
  Record<LogLevel, (message?: unknown, ...optionalParams: unknown[]) => void>
> = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export class BasicLoggerService
  extends AbstractService
  implements LoggerService
{
  public constructor(
    name: string,
    private readonly minLogLevel: LogLevel,
  ) {
    super(name);
    this.debug(this.name, "Service initialized");
  }

  public log(logLevel: LogLevel, scope: string, ...args: unknown[]): void {
    if (!this.shouldLog(logLevel)) {
      return;
    }

    const writer = LOG_WRITER[logLevel];
    const logMessage = this.createLogMessage({
      logLevel,
      scope,
      args,
      timestamp: new Date(),
    });
    writer(logMessage);
  }

  public debug(scope: string, ...args: unknown[]): void {
    this.log("debug", scope, ...args);
  }

  public info(scope: string, ...args: unknown[]): void {
    this.log("info", scope, ...args);
  }

  public warn(scope: string, ...args: unknown[]): void {
    this.log("warn", scope, ...args);
  }

  public error(scope: string, ...args: unknown[]): void {
    this.log("error", scope, ...args);
  }

  private shouldLog(logLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[logLevel] >= LOG_LEVEL_PRIORITY[this.minLogLevel];
  }

  private createLogMessage(props: {
    logLevel: LogLevel;
    scope: string;
    args: readonly unknown[];
    timestamp: Date;
  }): string {
    const { logLevel, scope, args, timestamp } = props;
    const formattedArgs = args.map((arg) => this.formatArg(arg)).join(" ");
    const suffix = formattedArgs.length > 0 ? ` ${formattedArgs}` : "";

    return `[${timestamp.toISOString()}] [${logLevel.toUpperCase()}] [${scope}]${suffix}`;
  }

  private formatArg(arg: unknown): string {
    if (arg instanceof Error) {
      return arg.stack ?? `${arg.name}: ${arg.message}`;
    }

    if (typeof arg === "string") {
      return arg;
    }

    if (typeof arg === "object" && arg !== null) {
      return this.stringify(arg);
    }

    return String(arg);
  }

  private stringify(value: object): string {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Unserializable Object]";
    }
  }
}
