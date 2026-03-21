import type { Service } from "../Service";

export interface StorageService extends Service {
  save: (key: string, value: string) => void;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}
