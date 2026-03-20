import { AbstractService } from "../AbstractService";
import type { NotificationService } from "./NotificationService";

export class BasicNotificationService
  extends AbstractService
  implements NotificationService
{
  public constructor(name: string) {
    super(name);
  }

  public notify(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}
