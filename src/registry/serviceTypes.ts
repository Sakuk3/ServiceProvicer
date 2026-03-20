import type {
  LoggerService,
  NetworkService,
  NotificationService,
  StorageService,
  AuthService,
} from "../services";

export interface Services {
  Logger: LoggerService;
  Storage: StorageService;
  Network: NetworkService;
  Auth: AuthService;
  Notification: NotificationService;
}

export type ServiceKey = keyof Services;
