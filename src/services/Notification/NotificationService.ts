import type { Service } from "../Service";

export interface NotificationService extends Service {
  notify: (message: string) => void;
}
