import { defineService } from "../../registry";
import { BasicNotificationService } from "./BasicNotificationService";

const serviceName = "Notification";

export const notificationManifest = defineService({
  name: serviceName,
  dependencies: ["Logger"],
  factory: (deps) => {
    const { Logger } = deps;
    return new BasicNotificationService(serviceName, Logger);
  },
});
