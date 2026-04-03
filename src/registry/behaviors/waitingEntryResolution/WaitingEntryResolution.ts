import type { ServiceKey } from "../../serviceTypes";
import type {
  CreateReadyHooksProps,
  FailedEntry,
  ReadyEntry,
  ReadyHooks,
  ServiceEntry,
  WaitingEntry,
} from "../../types";

export interface CanResolveWaitingEntryProps {
  entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
  entry: WaitingEntry;
}

export interface ResolveWaitingEntryProps {
  serviceName: ServiceKey;
  entry: WaitingEntry;
  createReadyHooks: (props: CreateReadyHooksProps) => ReadyHooks;
}

export interface WaitingEntryResolution {
  canResolveWaitingEntry(props: CanResolveWaitingEntryProps): boolean;
  resolveWaitingEntry(
    props: ResolveWaitingEntryProps,
  ): ReadyEntry | FailedEntry;
}
