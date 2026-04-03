import type { ServiceKey } from "../../serviceTypes";
import type { ServiceDependencyGraph, ServiceEntry } from "../../types";

export interface BuildDependencyGraphProps {
  entriesByService: ReadonlyMap<ServiceKey, ServiceEntry>;
}

export interface DependencyGraphBehavior {
  buildDependencyGraph(
    props: BuildDependencyGraphProps,
  ): ServiceDependencyGraph;
}
