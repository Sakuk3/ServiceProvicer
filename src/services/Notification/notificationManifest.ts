import { defineService } from "../../registry";
import { BasicNotificationService } from "./BasicNotificationService";

const serviceName = "Notification" as const;

export const notificationManifest = defineService({
  name: serviceName,
  description: "Notification service",
  dependencies: ["Logger"] as const,
  factory: (deps) => {
    const { Logger } = deps;
    console.log(`[${serviceName}] using ${Logger.name}`);
    return new BasicNotificationService(serviceName);
  },
});
