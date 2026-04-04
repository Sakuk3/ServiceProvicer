import { vi } from "vitest";
import type {
  AuthService,
  LoggerService,
  NetworkService,
  NotificationService,
  StorageService,
} from "./testTypeExtensions";
import type { LoginEventPayload } from "../../src";

export const createLoggerService = (): LoggerService => {
  return {
    name: "Logger",
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
};

export const createStorageService = (props: {
  onLogin: (payload: LoginEventPayload) => Promise<void>;
  onLogout: () => Promise<void>;
}): StorageService => {
  const { onLogin, onLogout } = props;

  return {
    name: "Storage",
    save: vi.fn(),
    handleLogin: onLogin,
    handleLogout: onLogout,
  };
};

export const createNetworkService = (props: {
  onRequest: (url: string) => Promise<void>;
}): NetworkService => {
  const { onRequest } = props;

  return {
    name: "Network",
    request: onRequest,
  };
};

export const createAuthService = (props: {
  isAuthenticated: boolean;
}): AuthService => {
  const { isAuthenticated } = props;

  return {
    name: "Auth",
    authenticate: () => isAuthenticated,
  };
};

export const createNotificationService = (): NotificationService => {
  return {
    name: "Notification",
    notify: vi.fn(),
  };
};
