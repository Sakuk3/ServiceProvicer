import { describe, expect, it, vi } from "vitest";
import {
  BaseHookOrchestration,
  defineService,
  type HookTask,
  type LoginEventPayload,
  type RegistryEventName,
  ServiceRegistry,
  type TriggerEventFailure,
} from "../../src";
import type { LoggerService, StorageService } from "./testTypeExtensions";
import {
  createLoggerService,
  createStorageService,
} from "./serviceTestFactories";

class LoggerServiceHookOrchestration extends BaseHookOrchestration {
  public constructor(logger: LoggerService | undefined) {
    super({ hookRetryAttempts: 1 });
    this.logger = logger;
  }

  private readonly logger: LoggerService | undefined;

  protected override onTriggerStart<E extends RegistryEventName>(props: {
    eventName: E;
    tasks: readonly HookTask<E>[];
  }): void {
    const { eventName, tasks } = props;
    this.info(
      "ServiceRegistry",
      `Triggering '${eventName}' for ${String(tasks.length)} hook(s)`,
    );
  }

  protected override onHookTaskSuccess<E extends RegistryEventName>(props: {
    eventName: E;
    task: HookTask<E>;
  }): void {
    const { eventName, task } = props;
    const { serviceName, hookName } = task;

    this.debug(
      "ServiceRegistry",
      `Event '${eventName}' completed for service '${serviceName}' via '${hookName}'`,
    );
  }

  protected override onTriggerComplete<E extends RegistryEventName>(props: {
    eventName: E;
    failures: readonly TriggerEventFailure<E>[];
  }): void {
    const { eventName, failures } = props;

    if (failures.length === 0) {
      this.info(
        "ServiceRegistry",
        `Event '${eventName}' completed successfully`,
      );
      return;
    }

    this.warn(
      "ServiceRegistry",
      `Event '${eventName}' completed with ${String(failures.length)} failure(s)`,
      failures,
    );
  }

  public debug(scope: string, ...args: unknown[]): void {
    this.logger?.debug(scope, ...args);
  }

  public info(scope: string, ...args: unknown[]): void {
    this.logger?.info(scope, ...args);
  }

  public warn(scope: string, ...args: unknown[]): void {
    this.logger?.warn(scope, ...args);
  }

  public error(scope: string, ...args: unknown[]): void {
    this.logger?.error(scope, ...args);
  }
}

const createRegistryWithLoggerBehavior = (
  logger: LoggerService | undefined,
): ServiceRegistry => {
  return new ServiceRegistry({
    hookOrchestration: new LoggerServiceHookOrchestration(logger),
  });
};

describe("ServiceRegistry hooks", () => {
  it("runs matching hooks and reports no failures on success", async () => {
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
    const loginPayload = { username: "alice" };
    const loginHook = vi
      .fn<(payload: LoginEventPayload) => Promise<void>>()
      .mockResolvedValue();
    const logoutHook = vi.fn(() => Promise.resolve());
    const storage = createStorageService({
      onLogin: loginHook,
      onLogout: logoutHook,
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
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({
      name: "login",
      payload: loginPayload,
    });

    expect(result).toEqual({ eventName: "login", failures: [] });
    expect(loginHook).toHaveBeenCalledTimes(1);
    expect(loginHook).toHaveBeenCalledWith(loginPayload);
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
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
    const failure = new Error("login failed");
    const storage = createStorageService({
      onLogin: () => Promise.reject(failure),
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
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({
      name: "login",
      payload: { username: "alice" },
    });

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
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
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
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({ name: "logout" });

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
        dependencies: [] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({
      name: "login",
      payload: { username: "alice" },
    });

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
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
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
        dependencies: [] as const,
        factory: () => logger,
      }),
    );
    registry.registerService(
      defineService({
        name: "Storage",
        dependencies: ["Logger"] as const,
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({
      name: "login",
      payload: { username: "alice" },
    });

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
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
    const failure = new Error("transient login failure");
    const loginHook = vi
      .fn<(payload: LoginEventPayload) => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce();
    const storage = createStorageService({
      onLogin: loginHook,
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
        hooks: {
          login: { method: "handleLogin", retry: true },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({
      name: "login",
      payload: { username: "alice" },
    });

    expect(result).toEqual({ eventName: "login", failures: [] });
    expect(loginHook).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failing hook when retry is not enabled", async () => {
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
    const failure = new Error("single attempt failure");
    const loginHook = vi
      .fn<(payload: LoginEventPayload) => Promise<void>>()
      .mockRejectedValue(failure);
    const storage = createStorageService({
      onLogin: loginHook,
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
        hooks: {
          login: { method: "handleLogin" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({
      name: "login",
      payload: { username: "alice" },
    });

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.errorMessage).toBe("single attempt failure");
    expect(result.failures[0]?.hookName).toBe("handleLogin");
    expect(loginHook).toHaveBeenCalledTimes(1);
  });
});
