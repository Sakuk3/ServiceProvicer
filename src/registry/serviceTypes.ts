import type { Service } from "../services/Service";

export interface Services {
  Logger: Service;
  Storage: Service;
  Network: Service;
  Auth: Service;
  Notification: Service;
}

export type ServiceKey = keyof Services;

