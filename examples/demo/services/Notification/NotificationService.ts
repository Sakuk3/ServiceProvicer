import type { Service } from "../../../../src";

export interface NotificationService extends Service {
  notify: (message: string) => void;
}
