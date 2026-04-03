import { HookExecutionError } from "../../errors";
import type { ServiceKey } from "../../serviceTypes";
import type {
  HookTask,
  RegistryEventName,
  RegistryEventPayload,
  ServiceEntry,
  TriggerEventFailure,
  TriggerEventResult,
} from "../../types";
import type {
  HookOrchestration,
  TriggerRegistryEventProps,
} from "./HookOrchestration";

interface BaseHookOrchestrationProps {
  hookRetryAttempts?: number;
}

export class BaseHookOrchestration implements HookOrchestration {
  private readonly hookRetryAttempts: number;

  public constructor(props: BaseHookOrchestrationProps = {}) {
    const { hookRetryAttempts = 1 } = props;

    this.hookRetryAttempts = hookRetryAttempts;
  }

  public async triggerEvent<E extends RegistryEventName>(
    props: TriggerRegistryEventProps<E>,
  ): Promise<TriggerEventResult<E>> {
    const { entriesByService, event, logger } = props;
    const { name: eventName, payload } = event;
    const tasks = this.getHookTasks({ entriesByService, eventName });

    this.logTriggerStart({ logger, eventName, taskCount: tasks.length });

    const settled = await this.executeHookTasks({
      logger,
      eventName,
      payload,
      tasks,
    });
    const failures = this.collectTriggerFailures({ eventName, settled });

    this.logTriggerSummary({ logger, eventName, failures });

    return {
      eventName,
      failures,
    };
  }

  private async runWithLifecyclePolicy<E extends RegistryEventName>(props: {
    task: HookTask<E>;
    payload: RegistryEventPayload<E> | undefined;
  }): Promise<void> {
    const { task, payload } = props;
    const { retry, run, serviceName, hookName } = task;
    const totalAttempts = retry ? this.hookRetryAttempts + 1 : 1;
    let latestReason: unknown;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      try {
        await run(payload);
        return;
      } catch (reason: unknown) {
        latestReason = reason;
      }
    }

    throw new HookExecutionError(serviceName, hookName, latestReason);
  }

  private getHookTasks<E extends RegistryEventName>(props: {
    entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
    eventName: E;
  }): HookTask<E>[] {
    const { entriesByService, eventName } = props;
    const tasks: HookTask<E>[] = [];

    entriesByService.forEach((entry, serviceName) => {
      if (entry.state !== "ready") {
        return;
      }

      const readyHook = entry.hooks[eventName];

      if (readyHook === undefined) {
        return;
      }

      const { methodName, run } = readyHook;

      tasks.push({
        serviceName,
        hookName: methodName,
        eventName,
        retry: readyHook.retry,
        run,
      });
    });

    return tasks;
  }

  private logTriggerStart(props: {
    logger: TriggerRegistryEventProps<RegistryEventName>["logger"];
    eventName: RegistryEventName;
    taskCount: number;
  }): void {
    const { logger, eventName, taskCount } = props;

    logger?.info(
      "ServiceRegistry",
      `Triggering '${eventName}' for ${String(taskCount)} hook(s)`,
    );
  }

  private async executeHookTasks<E extends RegistryEventName>(props: {
    logger: TriggerRegistryEventProps<E>["logger"];
    eventName: E;
    payload: RegistryEventPayload<E> | undefined;
    tasks: readonly HookTask<E>[];
  }): Promise<PromiseSettledResult<void>[]> {
    const { logger, eventName, payload, tasks } = props;

    return Promise.allSettled(
      tasks.map(async (task) => {
        const { serviceName, hookName } = task;

        await this.runWithLifecyclePolicy({ task, payload });
        logger?.debug(
          "ServiceRegistry",
          `Event '${eventName}' completed for service '${serviceName}' via '${hookName}'`,
        );
      }),
    );
  }

  private collectTriggerFailures<E extends RegistryEventName>(props: {
    eventName: E;
    settled: readonly PromiseSettledResult<void>[];
  }): TriggerEventFailure<E>[] {
    const { eventName, settled } = props;
    const failures: TriggerEventFailure<E>[] = [];

    for (const result of settled) {
      if (result.status !== "rejected") {
        continue;
      }

      failures.push(
        this.toTriggerFailure({
          eventName,
          reason: result.reason,
        }),
      );
    }

    return failures;
  }

  private toTriggerFailure<E extends RegistryEventName>(props: {
    eventName: E;
    reason: unknown;
  }): TriggerEventFailure<E> {
    const { eventName, reason } = props;

    if (reason instanceof HookExecutionError) {
      return {
        serviceName: reason.serviceName,
        hookName: reason.hookName,
        eventName,
        timestamp: new Date().toISOString(),
        errorMessage: this.toErrorMessage(reason.causeReason),
        reason: reason.causeReason,
      };
    }

    return {
      serviceName: "Unknown",
      hookName: "unknown",
      eventName,
      timestamp: new Date().toISOString(),
      errorMessage: this.toErrorMessage(reason),
      reason,
    };
  }

  private logTriggerSummary(props: {
    logger: TriggerRegistryEventProps<RegistryEventName>["logger"];
    eventName: RegistryEventName;
    failures: readonly TriggerEventFailure[];
  }): void {
    const { logger, eventName, failures } = props;

    if (failures.length === 0) {
      logger?.info(
        "ServiceRegistry",
        `Event '${eventName}' completed successfully`,
      );
      return;
    }

    logger?.warn(
      "ServiceRegistry",
      `Event '${eventName}' completed with ${String(failures.length)} failure(s)`,
      failures,
    );
  }

  private toErrorMessage(reason: unknown): string {
    if (reason instanceof Error) {
      return reason.message;
    }

    if (typeof reason === "string") {
      return reason;
    }

    return "Unknown error";
  }
}
