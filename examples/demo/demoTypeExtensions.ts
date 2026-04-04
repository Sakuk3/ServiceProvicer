import type { Service } from "../../src";
import type {
  AuthService,
  LoggerService,
  NetworkService,
  NotificationService,
  StorageService,
} from "./services";

export interface SessionRefreshEventPayload {
  username: string;
  refreshTokenId: string;
}

export interface AuditService extends Service {
  logSessionRefresh: (props: SessionRefreshEventPayload) => Promise<void>;
}

declare module "../../src/registry/registryEventTypes" {
  interface RegistryEvents {
    sessionRefresh: SessionRefreshEventPayload;
  }
}

declare module "../../src/registry/serviceTypes" {
  interface Services {
    Logger: LoggerService;
    Storage: StorageService;
    Network: NetworkService;
    Auth: AuthService;
    Notification: NotificationService;
    Audit: AuditService;
  }
}
