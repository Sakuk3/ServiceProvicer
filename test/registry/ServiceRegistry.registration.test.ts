import { describe, expect, it, vi } from "vitest";
import {
  defineService,
  ServiceAlreadyRegisteredError,
  ServiceDependencyNotReadyError,
  ServiceManifestDuplicateDependenciesError,
  ServiceRegistryCircularDependencyError,
  ServiceRegistryError,
  ServiceRegistry,
  type FailedServiceInfo,
  type WaitingEntryResolution,
} from "../../src";
import type {
  AuthService,
  LoggerService,
  NetworkService,
} from "./testTypeExtensions";
import {
  createAuthService,
  createLoggerService,
  createNetworkService,
  createNotificationService,
  createStorageService,
} from "./serviceTestFactories";

const getThrownError = (callback: () => void): Error => {
  try {
    callback();
  } catch (error: unknown) {
    if (error instanceof Error) {
      return error;
    }

    throw new Error("Expected registration callback to throw an Error", {
      cause: error,
    });
  }

  throw new Error("Expected registration callback to throw");
};

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
        dependencies: ["Auth", "Logger"] as const,
        factory: notificationFactory,
      }),
    );
    registry.registerService(
      defineService({
        name: "Auth",
        dependencies: ["Logger", "Network"] as const,
        factory: authFactory,
      }),
    );
    registry.registerService(
      defineService({
        name: "Network",
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

  it("throws when registration introduces a circular dependency chain", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const network = createNetworkService({
      onRequest: () => Promise.resolve(),
    });
    const auth = createAuthService({ isAuthenticated: true });

    registry.registerService(
      defineService({
        name: "Network",
        dependencies: ["Auth"] as const,
        factory: () => network,
      }),
    );

    const registerAuth = () => {
      registry.registerService(
        defineService({
          name: "Auth",
          dependencies: ["Network"] as const,
          factory: () => auth,
        }),
      );
    };

    expect(registerAuth).toThrow(
      "Circular dependency detected: Auth -> Network -> Auth",
    );

    let registrationError: Error | undefined;

    try {
      registerAuth();
    } catch (error: unknown) {
      if (error instanceof Error) {
        registrationError = error;
      }
    }

    if (registrationError === undefined) {
      throw new Error("Expected circular dependency registration to throw");
    }

    expect(registrationError).toBeInstanceOf(ServiceRegistryError);
    expect(registrationError).toBeInstanceOf(
      ServiceRegistryCircularDependencyError,
    );
    expect(registrationError.name).toBe(
      "ServiceRegistryCircularDependencyError",
    );
    expect(registrationError).toHaveProperty("cyclePath", [
      "Auth",
      "Network",
      "Auth",
    ]);

    registry.registerService(
      defineService({
        name: "Logger",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );

    expect(registry.getServiceUnsafe("Network")).toBeUndefined();
    expect(registry.getServiceUnsafe("Auth")).toBeUndefined();
    expect(registry.getServiceUnsafe("Logger")).toBe(logger);

    // Registering Auth fails, so only the original waiting service remains.
    expect(registry.listWaitingServices()).toEqual(["Network"]);
    expect(registry.getUnresolvedServices()).toEqual([
      {
        name: "Network",
        state: "waiting",
        dependencies: ["Auth"],
        missingDependencies: ["Auth"],
      },
    ]);
  });

  it("rejects duplicate service registration while the original service is waiting", () => {
    const registry = new ServiceRegistry();

    registry.registerService(
      defineService({
        name: "Storage",
        dependencies: ["Logger"] as const,
        factory: () =>
          createStorageService({
            onLogin: () => Promise.resolve(),
            onLogout: () => Promise.resolve(),
          }),
      }),
    );

    const registerDuplicateStorage = () => {
      registry.registerService(
        defineService({
          name: "Storage",
          dependencies: [] as const,
          factory: () =>
            createStorageService({
              onLogin: () => Promise.resolve(),
              onLogout: () => Promise.resolve(),
            }),
        }),
      );
    };

    expect(registerDuplicateStorage).toThrow(
      "Service 'Storage' is already registered",
    );
    const duplicateStorageError = getThrownError(registerDuplicateStorage);
    expect(duplicateStorageError).toBeInstanceOf(ServiceAlreadyRegisteredError);
    expect(duplicateStorageError).toBeInstanceOf(ServiceRegistryError);
  });

  it("rejects duplicate service registration after the original service is ready", () => {
    const registry = new ServiceRegistry();

    registry.registerService(
      defineService({
        name: "Logger",
        dependencies: [] as const,
        factory: () => createLoggerService(),
      }),
    );

    const registerDuplicateLogger = () => {
      registry.registerService(
        defineService({
          name: "Logger",
          dependencies: [] as const,
          factory: () => createLoggerService(),
        }),
      );
    };

    expect(registerDuplicateLogger).toThrow(
      "Service 'Logger' is already registered",
    );
    const duplicateLoggerError = getThrownError(registerDuplicateLogger);
    expect(duplicateLoggerError).toBeInstanceOf(ServiceAlreadyRegisteredError);
    expect(duplicateLoggerError).toBeInstanceOf(ServiceRegistryError);
  });

  it("marks a service as failed when its factory throws after dependencies are ready", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();

    registry.registerService(
      defineService({
        name: "Auth",
        dependencies: ["Logger"] as const,
        factory: () => {
          throw new Error("Auth factory failed");
        },
      }),
    );

    registry.registerService(
      defineService({
        name: "Logger",
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

  it("preserves factory error messages when marking services failed", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const wrappedFailureError = new Error("Unknown error");

    registry.registerService(
      defineService({
        name: "Logger",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );
    registry.registerService(
      defineService({
        name: "Auth",
        dependencies: ["Logger"] as const,
        factory: () => {
          throw new Error("factory string failure");
        },
      }),
    );
    registry.registerService(
      defineService({
        name: "Network",
        dependencies: ["Logger"] as const,
        factory: () => {
          throw wrappedFailureError;
        },
      }),
    );

    const unresolvedServices = registry.getUnresolvedServices();
    const failedAuthService = unresolvedServices.find(
      (entry): entry is FailedServiceInfo =>
        entry.state === "failed" && entry.name === "Auth",
    );
    const failedNetworkService = unresolvedServices.find(
      (entry): entry is FailedServiceInfo =>
        entry.state === "failed" && entry.name === "Network",
    );

    if (failedAuthService === undefined || failedNetworkService === undefined) {
      throw new Error("Expected failed entries for Auth and Network");
    }

    expect(failedAuthService.errorMessage).toBe("factory string failure");
    expect(failedAuthService.initError).toBeInstanceOf(Error);
    expect(failedNetworkService.errorMessage).toBe("Unknown error");
    expect(failedNetworkService.initError).toBe(wrappedFailureError);
  });

  it("returns unresolved dependency diagnostics for waiting services", () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();

    registry.registerService(
      defineService({
        name: "Notification",
        dependencies: ["Auth", "Logger"] as const,
        factory: () => createNotificationService(),
      }),
    );

    registry.registerService(
      defineService({
        name: "Logger",
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
    const registerInvalidManifest = () => {
      defineService({
        name: "Storage",
        dependencies: ["Logger", "Logger"] as const,
        factory: () =>
          createStorageService({
            onLogin: () => Promise.resolve(),
            onLogout: () => Promise.resolve(),
          }),
      });
    };

    expect(registerInvalidManifest).toThrow(
      "Service 'Storage' has duplicate dependencies: Logger",
    );
    const invalidManifestError = getThrownError(registerInvalidManifest);
    expect(invalidManifestError).toBeInstanceOf(
      ServiceManifestDuplicateDependenciesError,
    );
    expect(invalidManifestError).toBeInstanceOf(ServiceRegistryError);
  });

  it("throws when dependency resolution is forced before dependencies are ready", () => {
    const eagerWaitingEntryResolution: WaitingEntryResolution = {
      canResolveWaitingEntry: () => true,
      resolveWaitingEntry: (props) => {
        const { serviceName, entry, createReadyHooks } = props;
        const instance = entry.createInstance();

        return {
          state: "ready",
          dependencies: entry.dependencies,
          hooks: createReadyHooks({
            serviceName,
            instance,
            hookPolicies: entry.hookPolicies,
          }),
          instance,
        };
      },
    };
    const registry = new ServiceRegistry({
      waitingEntryResolution: eagerWaitingEntryResolution,
    });

    const thrownError = getThrownError(() => {
      registry.registerService(
        defineService({
          name: "Notification",
          dependencies: ["Logger"] as const,
          factory: () => createNotificationService(),
        }),
      );
    });

    expect(thrownError).toBeInstanceOf(ServiceDependencyNotReadyError);
    expect(thrownError.message).toBe("Dependency Logger not ready");

    if (!(thrownError instanceof ServiceDependencyNotReadyError)) {
      throw new Error(
        "Expected dependency readiness error type for eager resolution",
      );
    }

    expect(thrownError.dependencyName).toBe("Logger");
  });
});
