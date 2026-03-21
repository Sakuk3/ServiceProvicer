import { describe, expect, it } from "vitest";
import { defineService, ServiceRegistry } from "../../src/registry";
import {
  createLoggerService,
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
          description: "storage getter waiting test",
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
          description: "logger getter ready test",
          dependencies: [] as const,
          factory: () => logger,
        }),
      );
      registry.registerService(
        defineService({
          name: "Storage",
          description: "storage getter ready test",
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
});
