import { AbstractService } from "./AbstractService";
import { scopedLoggerFactory } from "./Logger";
import type { LoggerService, ScopedLogger } from "./Logger";

export abstract class AbstractLoggerService extends AbstractService {
  protected readonly logger: ScopedLogger;

  protected constructor(
    name: string,
    loggerService: LoggerService,
    scope: string = name,
  ) {
    super(name);
    this.logger = scopedLoggerFactory(loggerService, scope);
  }

  public override onLogin(): void {
    this.logger.info(`${this.name} logged in`);
  }

  public override onLogout(): void {
    this.logger.info(`${this.name} logged out`);
  }
}
