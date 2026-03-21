import { describe, expect, it, vi } from "vitest";
import {
  defineService,
  ServiceRegistry,
  type FailedServiceInfo,
} from "../../src/registry";
import type {
  AuthService,
  LoggerService,
  NetworkService,
} from "../../src/services";
import {
  createAuthService,
  createLoggerService,
  createNetworkService,
  createNotificationService,
  createStorageService,
} from "./serviceTestFactories";

describe("ServiceRegistry registration", () => {
  it("awaits dependencies when services are registered out of order", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const storage = createStorageService({
      onLogin: () => Promise.resolve(),
      onLogout: () => Promise.resolve(),
    });

    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage test service",
        dependencies: ["Logger"] as const,
        factory: (props) => {
          const { Logger } = props;
          Logger.debug("ServiceRegistryTest", "Storage factory resolved");
          return storage;
        },
      }),
    );

    expect(registry.getServiceUnsafe("Storage")).toBeUndefined();

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger test service",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );

    expect(registry.getServiceUnsafe("Storage")).toBe(storage);
    expect(logger.debug).toHaveBeenCalledWith(
      "ServiceRegistryTest",
      "Storage factory resolved",
    );
  });

  it("resolves multi-level dependency chains once all dependencies are ready", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const network = createNetworkService({
      onRequest: () => Promise.resolve(),
    });
    const auth = createAuthService({ isAuthenticated: true });
    const notification = createNotificationService();

    const networkFactory = vi.fn((props: { Logger: LoggerService }) => {
      const { Logger } = props;
      Logger.info("ServiceRegistryTest", "Network factory resolved");
      return network;
    });
    const authFactory = vi.fn(
      (props: { Logger: LoggerService; Network: NetworkService }) => {
        const { Logger, Network } = props;
        Logger.debug("ServiceRegistryTest", "Auth factory resolved");
        void Network.request("/health");
        return auth;
      },
    );
    const notificationFactory = vi.fn(
      (props: { Auth: AuthService; Logger: LoggerService }) => {
        const { Auth, Logger } = props;
        Logger.info(
          "ServiceRegistryTest",
          `Notification factory resolved auth=${String(Auth.authenticate("token"))}`,
        );
        return notification;
      },
    );

    registry.registerService(
      defineService({
        name: "Notification",
        description: "notification test service",
        dependencies: ["Auth", "Logger"] as const,
        factory: notificationFactory,
      }),
    );
    registry.registerService(
      defineService({
        name: "Auth",
        description: "auth test service",
        dependencies: ["Logger", "Network"] as const,
        factory: authFactory,
      }),
    );
    registry.registerService(
      defineService({
        name: "Network",
        description: "network test service",
        dependencies: ["Logger"] as const,
        factory: networkFactory,
      }),
    );

    expect(registry.getServiceUnsafe("Network")).toBeUndefined();
    expect(registry.getServiceUnsafe("Auth")).toBeUndefined();
    expect(registry.getServiceUnsafe("Notification")).toBeUndefined();

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger test service",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );

    expect(registry.getServiceUnsafe("Network")).toBe(network);
    expect(registry.getServiceUnsafe("Auth")).toBe(auth);
    expect(registry.getServiceUnsafe("Notification")).toBe(notification);
    expect(networkFactory).toHaveBeenCalledTimes(1);
    expect(authFactory).toHaveBeenCalledTimes(1);
    expect(notificationFactory).toHaveBeenCalledTimes(1);
  });

  it("keeps cyclic dependencies in waiting state", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const network = createNetworkService({
      onRequest: () => Promise.resolve(),
    });
    const auth = createAuthService({ isAuthenticated: true });

    registry.registerService(
      defineService({
        name: "Network",
        description: "network cycle test",
        dependencies: ["Auth"] as const,
        factory: () => network,
      }),
    );
    registry.registerService(
      defineService({
        name: "Auth",
        description: "auth cycle test",
        dependencies: ["Network"] as const,
        factory: () => auth,
      }),
    );
    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger test service",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );

    expect(registry.getServiceUnsafe("Network")).toBeUndefined();
    expect(registry.getServiceUnsafe("Auth")).toBeUndefined();
    expect(registry.getServiceUnsafe("Logger")).toBe(logger);
    expect(registry.getUnresolvedServices()).toEqual(
      expect.arrayContaining([
        {
          name: "Network",
          state: "waiting",
          dependencies: ["Auth"],
          missingDependencies: ["Auth"],
          cyclePath: ["Network", "Auth", "Network"],
        },
        {
          name: "Auth",
          state: "waiting",
          dependencies: ["Network"],
          missingDependencies: ["Network"],
          cyclePath: ["Auth", "Network", "Auth"],
        },
      ]),
    );
  });

  it("rejects duplicate service registration while the original service is waiting", () => {
    const registry = new ServiceRegistry();

    registry.registerService(
      defineService({
        name: "Storage",
        description: "first storage registration",
        dependencies: ["Logger"] as const,
        factory: () =>
          createStorageService({
            onLogin: () => Promise.resolve(),
            onLogout: () => Promise.resolve(),
          }),
      }),
    );

    expect(() => {
      registry.registerService(
        defineService({
          name: "Storage",
          description: "second storage registration",
          dependencies: [] as const,
          factory: () =>
            createStorageService({
              onLogin: () => Promise.resolve(),
              onLogout: () => Promise.resolve(),
            }),
        }),
      );
    }).toThrow("Service 'Storage' is already registered");
  });

  it("rejects duplicate service registration after the original service is ready", () => {
    const registry = new ServiceRegistry();

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger registration",
        dependencies: [] as const,
        factory: () => createLoggerService(),
      }),
    );

    expect(() => {
      registry.registerService(
        defineService({
          name: "Logger",
          description: "logger duplicate",
          dependencies: [] as const,
          factory: () => createLoggerService(),
        }),
      );
    }).toThrow("Service 'Logger' is already registered");
  });

  it("marks a service as failed when its factory throws after dependencies are ready", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();

    registry.registerService(
      defineService({
        name: "Auth",
        description: "auth init failure test",
        dependencies: ["Logger"] as const,
        factory: () => {
          throw new Error("Auth factory failed");
        },
      }),
    );

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger dependency for auth failure",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );

    const unresolvedServices = registry.getUnresolvedServices();
    const failedAuthService = unresolvedServices.find(
      (entry): entry is FailedServiceInfo =>
        entry.state === "failed" && entry.name === "Auth",
    );

    expect(registry.getServiceUnsafe("Auth")).toBeUndefined();
    expect(registry.getServiceUnsafe("Logger")).toBe(logger);
    expect(registry.listReadyServices()).toEqual(["Logger"]);
    expect(registry.listWaitingServices()).toEqual([]);
    expect(failedAuthService).toBeDefined();

    if (failedAuthService === undefined) {
      throw new Error("Expected Auth to be in failed unresolved services");
    }

    expect(failedAuthService.errorMessage).toBe("Auth factory failed");
    expect(failedAuthService.initError).toBeInstanceOf(Error);
  });

  it("returns unresolved dependency diagnostics for waiting services", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();

    registry.registerService(
      defineService({
        name: "Notification",
        description: "notification unresolved dependencies test",
        dependencies: ["Auth", "Logger"] as const,
        factory: () => createNotificationService(),
      }),
    );

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger for unresolved diagnostics",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );

    expect(registry.getServiceUnsafe("Notification")).toBeUndefined();
    expect(registry.listReadyServices()).toEqual(["Logger"]);
    expect(registry.listWaitingServices()).toEqual(["Notification"]);
    expect(registry.getUnresolvedServices()).toContainEqual({
      name: "Notification",
      state: "waiting",
      dependencies: ["Auth", "Logger"],
      missingDependencies: ["Auth"],
    });
  });

  it("rejects manifests with duplicate dependency entries", () => {
    expect(() => {
      defineService({
        name: "Storage",
        description: "duplicate dependency test",
        dependencies: ["Logger", "Logger"] as const,
        factory: () =>
          createStorageService({
            onLogin: () => Promise.resolve(),
            onLogout: () => Promise.resolve(),
          }),
      });
    }).toThrow("Service 'Storage' has duplicate dependencies: Logger");
  });
});
