import type { ServiceKey } from "../serviceTypes";
import type { ServiceEntry, UnresolvedServiceInfo } from "../types";
import { findWaitingCyclePath } from "./cycleDetection";

interface GetMissingDependenciesProps {
  entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
  dependencies: readonly ServiceKey[];
}

interface ToUnresolvedServiceInfoProps {
  entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
  serviceName: ServiceKey;
  entry: ServiceEntry;
}

export const getMissingDependencies = (
  props: GetMissingDependenciesProps,
): readonly ServiceKey[] => {
  const { entriesByService, dependencies } = props;

  return dependencies.filter((dependencyName) => {
    const dependencyEntry = entriesByService.get(dependencyName);
    return dependencyEntry?.state !== "ready";
  });
};

export const toUnresolvedServiceInfo = (
  props: ToUnresolvedServiceInfoProps,
): UnresolvedServiceInfo | undefined => {
  const { entriesByService, serviceName, entry } = props;

  if (entry.state === "waiting") {
    const cyclePath = findWaitingCyclePath({
      entriesByService,
      startServiceName: serviceName,
    });

    return {
      name: serviceName,
      state: "waiting",
      dependencies: entry.dependencies,
      missingDependencies: getMissingDependencies({
        entriesByService,
        dependencies: entry.dependencies,
      }),
      ...(cyclePath === undefined ? {} : { cyclePath }),
    };
  }

  if (entry.state === "failed") {
    return {
      name: serviceName,
      state: "failed",
      dependencies: entry.dependencies,
      errorMessage: entry.errorMessage,
      initError: entry.initError,
    };
  }

  return undefined;
};
