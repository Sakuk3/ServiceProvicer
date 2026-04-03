import { describe, expect, it } from "vitest";
import { defineService, ServiceRegistry } from "../../src";
import type { FailedServiceInfo } from "../../src";
import {
  createLoggerService,
  createNotificationService,
  createStorageService,
} from "./serviceTestFactories";

describe("ServiceRegistry getters", () => {
  describe("getServiceUnsafe", () => {
    it("returns undefined for unknown services", () => {
      const registry = new ServiceRegistry();

      expect(registry.getServiceUnsafe("Logger")).toBeUndefined();
      expect(registry.getServiceUnsafe("Storage")).toBeUndefined();
    });

    it("returns undefined while a service is waiting for dependencies", () => {
      const registry = new ServiceRegistry();
      const storage = createStorageService({
        onLogin: () => Promise.resolve(),
        onLogout: () => Promise.resolve(),
      });

      registry.registerService(
        defineService({
          name: "Storage",
          dependencies: ["Logger"] as const,
          factory: () => storage,
        }),
      );

      expect(registry.getServiceUnsafe("Storage")).toBeUndefined();
      expect(registry.getServiceUnsafe("Logger")).toBeUndefined();
    });

    it("returns exact instance references for ready services", () => {
      const registry = new ServiceRegistry();
      const logger = createLoggerService();
      const storage = createStorageService({
        onLogin: () => Promise.resolve(),
        onLogout: () => Promise.resolve(),
      });

      registry.registerService(
        defineService({
          name: "Logger",
          dependencies: [] as const,
          factory: () => logger,
        }),
      );
      registry.registerService(
        defineService({
          name: "Storage",
          dependencies: ["Logger"] as const,
          factory: () => storage,
        }),
      );

      const firstLoggerRead = registry.getServiceUnsafe("Logger");
      const secondLoggerRead = registry.getServiceUnsafe("Logger");
      const firstStorageRead = registry.getServiceUnsafe("Storage");
      const secondStorageRead = registry.getServiceUnsafe("Storage");

      expect(firstLoggerRead).toBe(logger);
      expect(secondLoggerRead).toBe(logger);
      expect(firstLoggerRead).toBe(secondLoggerRead);
      expect(firstStorageRead).toBe(storage);
      expect(secondStorageRead).toBe(storage);
      expect(firstStorageRead).toBe(secondStorageRead);
    });
  });

  describe("registry introspection", () => {
    it("lists ready and waiting services", () => {
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
          factory: () => storage,
        }),
      );

      expect(registry.listWaitingServices()).toEqual(["Storage"]);
      expect(registry.listReadyServices()).toEqual([]);

      registry.registerService(
        defineService({
          name: "Logger",
          dependencies: [] as const,
          factory: () => logger,
        }),
      );

      expect(registry.listReadyServices()).toEqual(["Storage", "Logger"]);
      expect(registry.listWaitingServices()).toEqual([]);
    });

    it("returns unresolved diagnostics for waiting and failed services", () => {
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
          name: "Auth",
          dependencies: ["Logger"] as const,
          factory: () => {
            throw new Error("Auth init failed");
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

      expect(registry.listReadyServices()).toEqual(["Logger"]);
      expect(registry.listWaitingServices()).toEqual(["Notification"]);
      expect(unresolvedServices).toHaveLength(2);
      expect(unresolvedServices).toEqual(
        expect.arrayContaining([
          {
            name: "Notification",
            state: "waiting",
            dependencies: ["Auth", "Logger"],
            missingDependencies: ["Auth"],
          },
        ]),
      );
      expect(failedAuthService).toBeDefined();

      if (failedAuthService === undefined) {
        throw new Error("Expected Auth to be in failed unresolved services");
      }

      expect(failedAuthService).toMatchObject({
        name: "Auth",
        state: "failed",
        dependencies: ["Logger"],
        errorMessage: "Auth init failed",
      });
      expect(failedAuthService.initError).toBeInstanceOf(Error);
    });

    it("returns dependency graph data for console visualization", () => {
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
          name: "Auth",
          dependencies: ["Logger"] as const,
          factory: () => {
            throw new Error("Auth init failed");
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

      expect(registry.getDependencyGraph()).toEqual({
        nodes: [
          {
            name: "Notification",
            state: "waiting",
            dependencies: ["Auth", "Logger"],
            missingDependencies: ["Auth"],
          },
          {
            name: "Auth",
            state: "failed",
            dependencies: ["Logger"],
            missingDependencies: [],
          },
          {
            name: "Logger",
            state: "ready",
            dependencies: [],
            missingDependencies: [],
          },
        ],
        edges: [
          {
            from: "Notification",
            to: "Auth",
            isRegistered: true,
            isReady: false,
          },
          {
            from: "Notification",
            to: "Logger",
            isRegistered: true,
            isReady: true,
          },
          {
            from: "Auth",
            to: "Logger",
            isRegistered: true,
            isReady: true,
          },
        ],
      });
    });
  });
});
