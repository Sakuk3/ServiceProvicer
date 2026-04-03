import type { ServiceKey } from "../serviceTypes";
import type { ServiceEntry } from "../types";

interface FindWaitingCyclePathProps {
  entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
  startServiceName: ServiceKey;
}

interface FindWaitingCyclePathFromProps {
  entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
  serviceName: ServiceKey;
  path: readonly ServiceKey[];
}

export const findWaitingCyclePath = (
  props: FindWaitingCyclePathProps,
): readonly ServiceKey[] | undefined => {
  const { entriesByService, startServiceName } = props;

  return findWaitingCyclePathFrom({
    entriesByService,
    serviceName: startServiceName,
    path: [],
  });
};

const findWaitingCyclePathFrom = (
  props: FindWaitingCyclePathFromProps,
): readonly ServiceKey[] | undefined => {
  const { entriesByService, serviceName, path } = props;
  const entry = entriesByService.get(serviceName);

  if (entry?.state !== "waiting") {
    return undefined;
  }

  const currentPath = [...path, serviceName];

  for (const dependencyName of entry.dependencies) {
    const dependencyEntry = entriesByService.get(dependencyName);

    if (dependencyEntry?.state !== "waiting") {
      continue;
    }

    const cycleStartIndex = currentPath.indexOf(dependencyName);

    if (cycleStartIndex !== -1) {
      return [...currentPath.slice(cycleStartIndex), dependencyName];
    }

    const cyclePath = findWaitingCyclePathFrom({
      entriesByService,
      serviceName: dependencyName,
      path: currentPath,
    });

    if (cyclePath !== undefined) {
      return cyclePath;
    }
  }

  return undefined;
};
