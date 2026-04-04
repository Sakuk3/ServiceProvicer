import { ServiceRegistry, visualizeServiceDependencyGraph } from "../src";
import "./demo/demoTypeExtensions";
import { LoggerServiceHookOrchestration } from "./demo/loggerHookOrchestration";
import {
  authManifest,
  networkManifest,
  notificationManifest,
  storageManifest,
} from "./demo/services";
import {
  auditManifest,
  demoLoggerManifest,
  demoLoggerService,
} from "./demo/demoServiceManifests";

const bootstrap = async (): Promise<void> => {
  const registry = new ServiceRegistry({
    hookOrchestration: new LoggerServiceHookOrchestration({
      loggerService: demoLoggerService,
    }),
  });

  registry.registerService(demoLoggerManifest);
  registry.registerService(storageManifest);
  registry.registerService(networkManifest);
  registry.registerService(authManifest);
  registry.registerService(notificationManifest);
  registry.registerService(auditManifest);

  const loginResult = await registry.triggerEvent({
    name: "login",
    payload: {
      username: "demo-user",
    },
  });
  const sessionRefreshResult = await registry.triggerEvent({
    name: "sessionRefresh",
    payload: {
      username: "demo-user",
      refreshTokenId: "refresh-token-001",
    },
  });
  const logoutResult = await registry.triggerEvent({ name: "logout" });

  const auditService = registry.getServiceUnsafe("Audit");

  if (auditService === undefined) {
    throw new Error("Audit service failed to resolve");
  }

  await auditService.logSessionRefresh({
    username: "demo-user",
    refreshTokenId: "manual-refresh-token-002",
  });

  if (
    loginResult.failures.length > 0 ||
    sessionRefreshResult.failures.length > 0 ||
    logoutResult.failures.length > 0
  ) {
    throw new Error("Lifecycle events completed with failures");
  }

  visualizeServiceDependencyGraph(registry.getDependencyGraph());
};

void bootstrap();
