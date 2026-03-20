import { AbstractService } from "./AbstractService";
import { defineService } from "../registry";

export class LoggerService extends AbstractService {
  readonly name = "Logger";

  public log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

export const loggerManifest = defineService({
  name: "Logger",
  description: "Application logger",
  dependencies: [] as const,
  factory: () => new LoggerService(),
});

