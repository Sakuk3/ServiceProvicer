import { ServiceRegistry } from "./registry";
import { authManifest } from "./services/Auth";
import { loggerManifest } from "./services/Logger";
import { networkManifest } from "./services/Network";
import { notificationManifest } from "./services/Notification";
import { storageManifest } from "./services/Storage";

const registry = new ServiceRegistry();

registry.registerService(authManifest);
registry.registerService(notificationManifest);
registry.registerService(networkManifest);
registry.registerService(storageManifest);
registry.registerService(loggerManifest);

