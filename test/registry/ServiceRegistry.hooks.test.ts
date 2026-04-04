import { describe, expect, it, vi } from "vitest";
import {
  BaseHookOrchestration,
  defineService,
  type HookPolicyMap,
  type HookPolicyNormalization,
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

class ThrowingOnSuccessHookOrchestration extends BaseHookOrchestration {
  public constructor(reason: Error) {
    super({ hookRetryAttempts: 1 });
    this.reason = reason;
  }

  private readonly reason: Error;

  protected override onHookTaskSuccess<E extends RegistryEventName>(props: {
    eventName: E;
    task: HookTask<E>;
  }): void {
    const { eventName, task } = props;

    void eventName;
    void task;
    throw this.reason;
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

  it("does not run hooks for services that are still waiting", async () => {
    const registry = new ServiceRegistry();
    const loginHook = vi
      .fn<(payload: LoginEventPayload) => Promise<void>>()
      .mockResolvedValue();
    const storage = createStorageService({
      onLogin: loginHook,
      onLogout: () => Promise.resolve(),
    });

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

    expect(result).toEqual({ eventName: "login", failures: [] });
    expect(loginHook).not.toHaveBeenCalled();
  });

  it("invokes logout hooks without passing payload arguments", async () => {
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
    const logoutHook = vi.fn(() => Promise.resolve());
    const storage = createStorageService({
      onLogin: () => Promise.resolve(),
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
          logout: { method: "handleLogout" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({ name: "logout" });

    expect(result).toEqual({ eventName: "logout", failures: [] });
    expect(logoutHook).toHaveBeenCalledTimes(1);
    expect(logoutHook).toHaveBeenCalledWith();
  });

  it("skips undefined normalized hook policies", async () => {
    const logger = createLoggerService();
    const logoutHook = vi.fn(() => Promise.resolve());
    const storage = createStorageService({
      onLogin: () => Promise.resolve(),
      onLogout: logoutHook,
    });
    const customHookPolicyNormalization: HookPolicyNormalization = {
      normalizeHookPolicies: (props) => {
        const { hooks } = props;

        if (hooks === undefined) {
          return {};
        }

        const hookPolicyMap: HookPolicyMap = {
          login: undefined,
          logout: { method: "handleLogout", retry: false },
        };

        return hookPolicyMap;
      },
    };
    const registry = new ServiceRegistry({
      hookPolicyNormalization: customHookPolicyNormalization,
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
          logout: { method: "handleLogout" },
        },
        factory: () => storage,
      }),
    );

    const result = await registry.triggerEvent({ name: "logout" });

    expect(result).toEqual({ eventName: "logout", failures: [] });
    expect(logoutHook).toHaveBeenCalledTimes(1);
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

  it("normalizes string hook rejection reasons to readable messages", async () => {
    const logger = createLoggerService();
    const registry = createRegistryWithLoggerBehavior(logger);
    const storage = createStorageService({
      onLogin: () => Promise.reject(new Error("string failure")),
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
      errorMessage: "string failure",
    });
    expect(result.failures[0]?.reason).toBeInstanceOf(Error);
  });

  it("maps orchestration callback failures to unknown service metadata", async () => {
    const orchestrationReason = new Error("post-hook callback failed");
    const hookOrchestration = new ThrowingOnSuccessHookOrchestration(
      orchestrationReason,
    );
    const registry = new ServiceRegistry({ hookOrchestration });
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

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      serviceName: "Unknown",
      hookName: "unknown",
      eventName: "login",
      errorMessage: "post-hook callback failed",
      reason: orchestrationReason,
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
