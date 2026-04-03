import type { ServiceKey } from "../../serviceTypes";
import type {
  HookPolicyMap,
  LifecycleHookPolicy,
  RegistryEventName,
  ResolvedLifecycleHookPolicy,
} from "../../types";
import type {
  HookPolicyNormalization,
  NormalizeHookPoliciesProps,
} from "./HookPolicyNormalization";

export class BaseHookPolicyNormalization implements HookPolicyNormalization {
  public normalizeHookPolicies<K extends ServiceKey>(
    props: NormalizeHookPoliciesProps<K>,
  ): HookPolicyMap {
    const { hooks } = props;
    const hookPolicyMap: HookPolicyMap = {};

    if (hooks === undefined) {
      return hookPolicyMap;
    }

    for (const eventName of Object.keys(hooks) as RegistryEventName[]) {
      const policy = hooks[eventName];

      if (policy !== undefined) {
        hookPolicyMap[eventName] = this.validateHookPolicy(policy);
      }
    }

    return hookPolicyMap;
  }

  private validateHookPolicy(
    policy: LifecycleHookPolicy,
  ): ResolvedLifecycleHookPolicy {
    const { method, retry } = policy;

    return {
      method,
      retry: retry ?? false,
    };
  }
}
