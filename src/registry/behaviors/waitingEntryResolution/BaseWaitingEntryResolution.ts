import type { ServiceKey } from "../../serviceTypes";
import type { FailedEntry, ReadyEntry } from "../../types";
import type {
  CanResolveWaitingEntryProps,
  ResolveWaitingEntryProps,
  WaitingEntryResolution,
} from "./WaitingEntryResolution";

interface ToFailedEntryProps {
  dependencies: readonly ServiceKey[];
  initError: unknown;
}

export class BaseWaitingEntryResolution implements WaitingEntryResolution {
  public canResolveWaitingEntry(props: CanResolveWaitingEntryProps): boolean {
    const { entriesByService, entry } = props;

    return entry.dependencies.every(
      (dependencyName) =>
        entriesByService.get(dependencyName)?.state === "ready",
    );
  }

  public resolveWaitingEntry(
    props: ResolveWaitingEntryProps,
  ): ReadyEntry | FailedEntry {
    const { serviceName, entry, createReadyHooks } = props;

    try {
      const instance = entry.createInstance();
      const hooks = createReadyHooks({
        serviceName,
        instance,
        hookPolicies: entry.hookPolicies,
      });

      return {
        state: "ready" as const,
        dependencies: entry.dependencies,
        instance,
        hooks,
      };
    } catch (initError: unknown) {
      return this.toFailedEntry({
        dependencies: entry.dependencies,
        initError,
      });
    }
  }

  private toFailedEntry(props: ToFailedEntryProps): FailedEntry {
    const { dependencies, initError } = props;

    return {
      state: "failed",
      dependencies,
      initError,
      errorMessage: this.toErrorMessage(initError),
    };
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
