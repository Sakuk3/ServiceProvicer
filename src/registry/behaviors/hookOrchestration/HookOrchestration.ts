import type { ServiceKey } from "../../serviceTypes";
import type {
  RegistryEvent,
  RegistryEventName,
  ServiceEntry,
  TriggerEventResult,
} from "../../types";

export interface TriggerRegistryEventProps<E extends RegistryEventName> {
  entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
  event: RegistryEvent<E>;
}

export interface HookOrchestration {
  triggerEvent<E extends RegistryEventName>(
    props: TriggerRegistryEventProps<E>,
  ): Promise<TriggerEventResult<E>>;
}
