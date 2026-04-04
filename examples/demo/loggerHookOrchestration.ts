import {
  BaseHookOrchestration,
  type HookTask,
  type RegistryEventName,
  type TriggerEventFailure,
} from "../../src";
import type { LoggerService } from "./services";

export class LoggerServiceHookOrchestration extends BaseHookOrchestration {
  public constructor(props: {
    loggerService: LoggerService;
    hookRetryAttempts?: number;
  }) {
    const { loggerService, hookRetryAttempts = 1 } = props;

    super({ hookRetryAttempts });

    this.loggerService = loggerService;
  }

  private readonly loggerService: LoggerService;

  protected override onTriggerStart<E extends RegistryEventName>(props: {
    eventName: E;
    tasks: readonly HookTask<E>[];
  }): void {
    const { eventName, tasks } = props;
    this.loggerService.info(
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

    this.loggerService.debug(
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
      this.loggerService.info(
        "ServiceRegistry",
        `Event '${eventName}' completed successfully`,
      );

      return;
    }

    this.loggerService.warn(
      "ServiceRegistry",
      `Event '${eventName}' completed with ${String(failures.length)} failure(s)`,
      failures,
    );
  }
}
