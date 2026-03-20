import type { Service } from "../Service";

export interface NetworkService extends Service {
  request: (url: string) => Promise<void>;
}
