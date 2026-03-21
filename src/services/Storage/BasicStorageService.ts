import { AbstractLoggerService } from "../AbstractLoggerService";
import type { LoggerService } from "../Logger";
import type { StorageService } from "./StorageService";
import type { LoginEventPayload } from "../../registry";

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

  public handleLogin(props: LoginEventPayload): Promise<void> {
    const { username } = props;

    this.logger.info(
      "handleLogin",
      `Storage login hook executed for ${username}`,
    );
    return Promise.resolve();
  }

  public handleLogout(): Promise<void> {
    this.logger.info("handleLogout", "Storage logout hook executed");
    return Promise.resolve();
  }
}
