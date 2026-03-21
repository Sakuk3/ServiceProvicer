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

const bootstrap = async (): Promise<void> => {
  const loginResult = await registry.triggerEvent("login");
  const logoutResult = await registry.triggerEvent("logout");

  if (loginResult.failures.length > 0 || logoutResult.failures.length > 0) {
    throw new Error("Lifecycle events completed with failures");
  }
};

void bootstrap();
