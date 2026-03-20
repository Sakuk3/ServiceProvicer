import type { Service } from "../Service";

export interface LoggerService extends Service {
  log: (message: string) => void;
}
