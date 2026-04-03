import type {
  ServiceDependencyGraph,
  ServiceDependencyGraphEdge,
  ServiceDependencyGraphNode,
} from "../../types";
import { getMissingDependencies } from "../../utils/serviceEntryDiagnostics";
import type {
  BuildDependencyGraphProps,
  DependencyGraphBehavior,
} from "./DependencyGraphBehavior";

export class BaseDependencyGraphBehavior implements DependencyGraphBehavior {
  public buildDependencyGraph(
    props: BuildDependencyGraphProps,
  ): ServiceDependencyGraph {
    const { entriesByService } = props;
    const nodes: ServiceDependencyGraphNode[] = [];
    const edges: ServiceDependencyGraphEdge[] = [];

    entriesByService.forEach((entry, serviceName) => {
      const { dependencies } = entry;

      nodes.push({
        name: serviceName,
        state: entry.state,
        dependencies,
        missingDependencies: getMissingDependencies({
          entriesByService,
          dependencies,
        }),
      });

      dependencies.forEach((dependencyName) => {
        const dependencyEntry = entriesByService.get(dependencyName);

        edges.push({
          from: serviceName,
          to: dependencyName,
          isRegistered: dependencyEntry !== undefined,
          isReady: dependencyEntry?.state === "ready",
        });
      });
    });

    return {
      nodes,
      edges,
    };
  }
}
