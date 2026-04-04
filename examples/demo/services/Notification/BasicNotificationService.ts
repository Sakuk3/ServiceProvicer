import { AbstractLoggerService } from "../AbstractLoggerService";
import type { LoggerService } from "../Logger";
import type { NotificationService } from "./NotificationService";

export class BasicNotificationService
  extends AbstractLoggerService
  implements NotificationService
{
  public constructor(name: string, loggerService: LoggerService) {
    super(name, loggerService);
    this.logger.debug("Service initialized");
  }

  public notify(message: string): void {
    this.logger.info("notify", message);
  }
}
