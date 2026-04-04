import type { Service, LoginEventPayload } from "../../src";

export interface LoggerService extends Service {
  log: (
    logLevel: "debug" | "info" | "warn" | "error",
    scope: string,
    ...args: unknown[]
  ) => void;
  debug: (scope: string, ...args: unknown[]) => void;
  info: (scope: string, ...args: unknown[]) => void;
  warn: (scope: string, ...args: unknown[]) => void;
  error: (scope: string, ...args: unknown[]) => void;
}

export interface StorageService extends Service {
  save: (key: string, value: string) => void;
  handleLogin: (props: LoginEventPayload) => Promise<void>;
  handleLogout: () => Promise<void>;
}

export interface NetworkService extends Service {
  request: (url: string) => Promise<void>;
}

export interface AuthService extends Service {
  authenticate: (token: string) => boolean;
}

export interface NotificationService extends Service {
  notify: (message: string) => void;
}

declare module "../../src/registry/serviceTypes" {
  interface Services {
    Logger: LoggerService;
    Storage: StorageService;
    Network: NetworkService;
    Auth: AuthService;
    Notification: NotificationService;
  }
}
