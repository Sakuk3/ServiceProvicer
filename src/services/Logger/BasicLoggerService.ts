import { AbstractService } from "../AbstractService";
import type { LoggerService } from "./LoggerService";

export class BasicLoggerService
  extends AbstractService
  implements LoggerService
{
  public constructor(name: string) {
    super(name);
  }

  public log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}
