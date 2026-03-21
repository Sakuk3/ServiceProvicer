import { describe, expect, it, vi } from "vitest";
import { defineService, ServiceRegistry } from "../../src/registry";
import type { StorageService } from "../../src/services";
import {
  createLoggerService,
  createStorageService,
} from "./serviceTestFactories";

describe("ServiceRegistry hooks", () => {
  it("runs matching hooks and reports no failures on success", async () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const loginHook = vi.fn(() => Promise.resolve());
    const logoutHook = vi.fn(() => Promise.resolve());
    const storage = createStorageService({
      onLogin: loginHook,
      onLogout: logoutHook,
    });

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger hook test",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );
    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage hook test",
        dependencies: ["Logger"] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent("login");

    expect(result).toEqual({ eventName: "login", failures: [] });
    expect(loginHook).toHaveBeenCalledTimes(1);
    expect(logoutHook).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "ServiceRegistry",
      "Triggering 'login' for 1 hook(s)",
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "ServiceRegistry",
      "Event 'login' completed for service 'Storage' via 'handleLogin'",
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
          login: { method: "handleLogin" },
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
      eventName: "login",
      errorMessage: "login failed",
      reason: failure,
    });
    expect(result.failures[0]?.timestamp).toBeTypeOf("string");
    expect(logger.warn).toHaveBeenCalledWith(
      "ServiceRegistry",
      "Event 'login' completed with 1 failure(s)",
      result.failures,
    );
  });

  it("ignores events that have no configured hook method", async () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const storage = createStorageService({
      onLogin: () => Promise.resolve(),
      onLogout: () => Promise.resolve(),
    });

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger hook test",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );
    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage hook test",
        dependencies: ["Logger"] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent("logout");

    expect(result).toEqual({ eventName: "logout", failures: [] });
    expect(logger.info).toHaveBeenCalledWith(
      "ServiceRegistry",
      "Triggering 'logout' for 0 hook(s)",
    );
  });

  it("handles events safely when logger service is missing", async () => {
    const registry = new ServiceRegistry();
    const storage = createStorageService({
      onLogin: () => Promise.resolve(),
      onLogout: () => Promise.resolve(),
    });

    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage no logger test",
        dependencies: [] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent("login");

    expect(result).toEqual({ eventName: "login", failures: [] });
  });

  it("marks service as failed when a configured hook is not callable", () => {
    const registry = new ServiceRegistry();
    const invalidStorage = {
      name: "Storage",
      save: vi.fn(),
      handleLogin: "not-a-function",
      handleLogout: () => Promise.resolve(),
    } as unknown as StorageService;

    registry.registerService(
      defineService({
        name: "Storage",
        description: "invalid hook test",
        dependencies: [] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => invalidStorage,
      }),
    );

    const unresolved = registry.getUnresolvedServices();

    expect(registry.getServiceUnsafe("Storage")).toBeUndefined();
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]).toMatchObject({
      name: "Storage",
      state: "failed",
      errorMessage: "Hook 'handleLogin' is not callable on service 'Storage'",
    });
  });

  it("normalizes non-Error hook rejection shapes in failures", async () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const nonErrorReason = { code: "E_HOOK", detail: "failed" };
    const storage = createStorageService({
      onLogin: () =>
        new Promise<void>((_resolve, reject) => {
          reject(nonErrorReason as unknown as Error);
        }),
      onLogout: () => Promise.resolve(),
    });

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger non-error hook test",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );
    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage non-error hook test",
        dependencies: ["Logger"] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent("login");

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      serviceName: "Storage",
      hookName: "handleLogin",
      eventName: "login",
      errorMessage: "Unknown error",
      reason: nonErrorReason,
    });
    expect(result.failures[0]?.timestamp).toBeTypeOf("string");
  });

  it("retries a failing hook when retry is enabled", async () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const failure = new Error("transient login failure");
    const loginHook = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce();
    const storage = createStorageService({
      onLogin: loginHook,
      onLogout: () => Promise.resolve(),
    });

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger retry hook test",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );
    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage retry hook test",
        dependencies: ["Logger"] as const,
        hooks: {
          login: { method: "handleLogin", retry: true },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent("login");

    expect(result).toEqual({ eventName: "login", failures: [] });
    expect(loginHook).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failing hook when retry is not enabled", async () => {
    const registry = new ServiceRegistry();
    const logger = createLoggerService();
    const failure = new Error("single attempt failure");
    const loginHook = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
    const storage = createStorageService({
      onLogin: loginHook,
      onLogout: () => Promise.resolve(),
    });

    registry.registerService(
      defineService({
        name: "Logger",
        description: "logger timeout hook test",
        dependencies: [] as const,
        factory: () => logger,
      }),
    );
    registry.registerService(
      defineService({
        name: "Storage",
        description: "storage no retry hook test",
        dependencies: ["Logger"] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent("login");

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.errorMessage).toBe("single attempt failure");
    expect(result.failures[0]?.hookName).toBe("handleLogin");
    expect(loginHook).toHaveBeenCalledTimes(1);
  });
});
