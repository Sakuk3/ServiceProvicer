import { AbstractLoggerService } from "../AbstractLoggerService";
import type { LoggerService } from "../Logger";
import type { NetworkService } from "./NetworkService";
import type { StorageService } from "../Storage";

export class BasicNetworkService
  extends AbstractLoggerService
  implements NetworkService
{
  public constructor(
    name: string,
    loggerService: LoggerService,
    private storageService: StorageService,
  ) {
    super(name, loggerService);
    this.logger.debug(`Service initialized with ${this.storageService.name}`);
  }

  public request(url: string): Promise<void> {
    this.logger.debug("request", `request to ${url}`);
    return Promise.resolve();
  }
}
