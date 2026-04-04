import { defineService } from "../../src";
import {
  AbstractLoggerService,
  BasicLoggerService,
  type LoggerService,
  type StorageService,
} from "./services";
import type {
  AuditService,
  SessionRefreshEventPayload,
} from "./demoTypeExtensions";

class DemoAuditService extends AbstractLoggerService implements AuditService {
  public constructor(
    name: string,
    loggerService: LoggerService,
    storageService: StorageService,
  ) {
    super(name, loggerService);
    this.storageService = storageService;
    this.logger.debug("constructor", "Service initialized");
  }

  private readonly storageService: StorageService;

  public logSessionRefresh(props: SessionRefreshEventPayload): Promise<void> {
    const { username, refreshTokenId } = props;

    this.storageService.save(`audit:${username}`, refreshTokenId);
    this.logger.info(
      "logSessionRefresh",
      `Recorded refresh audit for ${username}`,
    );

    return Promise.resolve();
  }
}

const loggerServiceName = "Logger";
export const demoLoggerService = new BasicLoggerService(
  loggerServiceName,
  "debug",
);

export const demoLoggerManifest = defineService({
  name: loggerServiceName,
  dependencies: [],
  factory: () => {
    return demoLoggerService;
  },
});

const auditServiceName = "Audit";
export const auditManifest = defineService({
  name: auditServiceName,
  dependencies: ["Logger", "Storage"],
  hooks: {
    sessionRefresh: { method: "logSessionRefresh", retry: true },
  },
  factory: (deps) => {
    const { Logger, Storage } = deps;
    return new DemoAuditService(auditServiceName, Logger, Storage);
  },
});
