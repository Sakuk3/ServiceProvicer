import type { Service } from "../Service";
import type { LoginEventPayload } from "../../registry";

export interface StorageService extends Service {
  save: (key: string, value: string) => void;
  handleLogin: (props: LoginEventPayload) => Promise<void>;
  handleLogout: () => Promise<void>;
}
