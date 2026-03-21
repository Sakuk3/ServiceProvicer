import { describe, expect, it, vi } from "vitest";
import { defineService, ServiceRegistry } from "../../src/registry";
import type { LoggerService, StorageService } from "../../src/services";

const createLoggerService = (): LoggerService => {
  return {
    name: "Logger",
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
};

const createStorageService = (props: {
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
}): StorageService => {
  const { onLogin, onLogout } = props;

  return {
    name: "Storage",
    save: vi.fn(),
    handleLogin: onLogin,
    handleLogout: onLogout,
  };
};

describe("ServiceRegistry", () => {
  it("resolves waiting services after dependencies become ready", () => {
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

  it("captures hook failures during event triggering", async () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const failure = new Error("login failed");
    const storage = createStorageService({
      onLogin: () => Promise.reject(failure),
      onLogout: () => Promise.resolve(),
    });

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger test service",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );

    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage test service",
        dependencies: ["Logger"] as const,
        hooks: {
          login: "handleLogin",
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent("login");

    expect(result.eventName).toBe("login");
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      serviceName: "Storage",
      hookName: "handleLogin",
      reason: failure,
    });
    expect(logger.warn).toHaveBeenCalled();
  });
});
