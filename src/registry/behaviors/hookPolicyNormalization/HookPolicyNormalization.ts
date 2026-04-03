import type { ServiceHooks } from "../../manifest";
import type { ServiceKey } from "../../serviceTypes";
import type { HookPolicyMap } from "../../types";

export interface NormalizeHookPoliciesProps<K extends ServiceKey> {
  hooks: ServiceHooks<K> | undefined;
}

export interface HookPolicyNormalization {
  normalizeHookPolicies<K extends ServiceKey>(
    props: NormalizeHookPoliciesProps<K>,
  ): HookPolicyMap;
}
