import { defineService } from "../../registry";
import { BasicNotificationService } from "./BasicNotificationService";

const serviceName = "Notification";

export const notificationManifest = defineService({
  name: serviceName,
  description: "Notification service",
  dependencies: ["Logger"],
  factory: (deps) => {
    const { Logger } = deps;
    return new BasicNotificationService(serviceName, Logger);
  },
});
