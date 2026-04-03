import {
  authManifest,
  loggerManifest,
  networkManifest,
  notificationManifest,
  storageManifest,
  ServiceRegistry,
  visualizeServiceDependencyGraph,
} from "../src";

const registry = new ServiceRegistry();

registry.registerService(authManifest);
registry.registerService(notificationManifest);
registry.registerService(networkManifest);
registry.registerService(storageManifest);
registry.registerService(loggerManifest);

const bootstrap = async (): Promise<void> => {
  const loginResult = await registry.triggerEvent({
    name: "login",
    payload: {
      username: "demo-user",
    },
  });
  const logoutResult = await registry.triggerEvent({ name: "logout" });

  if (loginResult.failures.length > 0 || logoutResult.failures.length > 0) {
    throw new Error("Lifecycle events completed with failures");
  }

  visualizeServiceDependencyGraph(registry.getDependencyGraph());
};

void bootstrap();
