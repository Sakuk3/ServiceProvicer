import { AbstractLoggerService } from "../AbstractLoggerService";
import type { LoggerService } from "../Logger";
import type { AuthService } from "./AuthService";
import { NetworkService } from "../Network";

export class BasicAuthService
  extends AbstractLoggerService
  implements AuthService
{
  public constructor(
    name: string,
    loggerService: LoggerService,
    private networkService: NetworkService,
  ) {
    super(name, loggerService);
    this.logger.debug(`Service initialized with ${this.networkService.name}`);
  }

  public authenticate(token: string): boolean {
    return token.length > 0;
  }
}
