import { AbstractLoggerService } from "../AbstractLoggerService";
import type { LoggerService } from "../Logger";
import type { StorageService } from "./StorageService";

export class BasicStorageService
  extends AbstractLoggerService
  implements StorageService
{
  public constructor(name: string, loggerService: LoggerService) {
    super(name, loggerService);
    this.logger.debug("Service initialized");
  }

  private readonly records = new Map<string, string>();

  public save(key: string, value: string): void {
    this.records.set(key, value);
    this.logger.debug("save", `Stored value for key ${key}`);
  }
}
