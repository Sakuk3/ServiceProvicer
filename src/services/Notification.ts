import { AbstractService } from "./AbstractService";
import { defineService } from "../registry";

export class NotificationService extends AbstractService {
  readonly name = "Notification";
}

export const notificationManifest = defineService({
  name: "Notification",
  description: "Notification service",
  dependencies: ["Logger"] as const,
  factory: (deps) => {
    const { Logger } = deps;
    console.log(`[Notification] using ${Logger.name}`);
    return new NotificationService();
  },
});

