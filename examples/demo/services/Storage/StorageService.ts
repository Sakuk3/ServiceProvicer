import type { Service, LoginEventPayload } from "../../../../src";

export interface StorageService extends Service {
  save: (key: string, value: string) => void;
  handleLogin: (props: LoginEventPayload) => Promise<void>;
  handleLogout: () => Promise<void>;
}
