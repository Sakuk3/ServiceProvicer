import { ServiceRegistry } from "./registry";
import {
  authManifest,
  loggerManifest,
  networkManifest,
  notificationManifest,
  storageManifest,
} from "./services";

const registry = new ServiceRegistry();

registry.registerService(authManifest);
registry.registerService(notificationManifest);
registry.registerService(networkManifest);
registry.registerService(storageManifest);
registry.registerService(loggerManifest);
