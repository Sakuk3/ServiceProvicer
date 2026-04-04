import type { ServiceDependencyGraph } from "./types";

const toStateLabel = (state: string): string => {
  return `[${state}]`;
};

const toDependencyLabel = (props: {
  dependencyName: string;
  isRegistered: boolean;
  isReady: boolean;
  dependencyState: string;
  isReference: boolean;
}): string => {
  const {
    dependencyName,
    isRegistered,
    isReady,
    dependencyState,
    isReference,
  } = props;

  if (!isRegistered) {
    return `${dependencyName} [missing]`;
  }

  const readinessSuffix = isReady ? "" : " [not-ready]";
  const referenceSuffix = isReference ? " [ref]" : "";

  return `${dependencyName} ${toStateLabel(dependencyState)}${readinessSuffix}${referenceSuffix}`;
};

const getRootServiceNames = (
  graph: ServiceDependencyGraph,
): readonly string[] => {
  const { nodes, edges } = graph;
  const dependencyTargets = new Set(
    edges.map((edge) => {
      const { to } = edge;
      return to;
    }),
  );

  return nodes
    .map((node) => {
      const { name } = node;
      return name;
    })
    .filter((serviceName) => !dependencyTargets.has(serviceName));
};

type DependencyEdge = ServiceDependencyGraph["edges"][number];

const printDependencyEdges = (props: {
  serviceName: string;
  prefix: string;
  edgesBySource: ReadonlyMap<string, readonly DependencyEdge[]>;
  nodeStateByName: ReadonlyMap<string, string>;
  expandedServices: Set<string>;
}): void => {
  const {
    serviceName,
    prefix,
    edgesBySource,
    nodeStateByName,
    expandedServices,
  } = props;

  const childEdges = edgesBySource.get(serviceName) ?? [];

  if (childEdges.length === 0) {
    return;
  }

  childEdges.forEach((edge, edgeIndex) => {
    const { to, isRegistered, isReady } = edge;
    const isReference = isRegistered && expandedServices.has(to);
    const dependencyState = nodeStateByName.get(to) ?? "unknown";
    const edgePrefix = `${prefix}${edgeIndex === childEdges.length - 1 ? "└─>" : "├─>"}`;

    console.log(
      `${edgePrefix} ${toDependencyLabel({
        dependencyName: to,
        isRegistered,
        isReady,
        dependencyState,
        isReference,
      })}`,
    );

    if (!isRegistered || isReference) {
      return;
    }

    expandedServices.add(to);
    const nextPrefix = `${prefix}${
      edgeIndex === childEdges.length - 1 ? "   " : "│  "
    }`;

    printDependencyEdges({
      serviceName: to,
      prefix: nextPrefix,
      edgesBySource,
      nodeStateByName,
      expandedServices,
    });
  });
};

export const visualizeServiceDependencyGraph = (
  graph: ServiceDependencyGraph,
): void => {
  const { nodes, edges } = graph;
  const nodeStateByName = new Map<string, string>(
    nodes.map((node) => {
      const { name, state } = node;
      return [name, state] as const;
    }),
  );
  const edgesBySource = new Map<string, DependencyEdge[]>(
    nodes.map((node) => {
      const { name } = node;
      return [name, []] as const;
    }),
  );
  const expandedServices = new Set<string>();
  const rootServiceNames = getRootServiceNames(graph);
  const allServiceNames = nodes.map((node) => {
    const { name } = node;
    return name;
  });

  edges.forEach((edge) => {
    const { from } = edge;
    const currentSourceEdges = edgesBySource.get(from) ?? [];

    currentSourceEdges.push(edge);
    edgesBySource.set(from, currentSourceEdges);
  });

  console.log("Service dependency graph (single view, service -> dependency)");

  if (nodes.length === 0) {
    console.log("  (none)");
    return;
  }

  const entryPoints =
    rootServiceNames.length > 0 ? rootServiceNames : allServiceNames;

  entryPoints.forEach((serviceName, index) => {
    const serviceState = nodeStateByName.get(serviceName) ?? "unknown";
    const servicePrefix = index === entryPoints.length - 1 ? "└─ " : "├─ ";
    const childPrefix = index === entryPoints.length - 1 ? "   " : "│  ";

    console.log(`${servicePrefix}${serviceName} ${toStateLabel(serviceState)}`);
    expandedServices.add(serviceName);

    printDependencyEdges({
      serviceName,
      prefix: childPrefix,
      edgesBySource,
      nodeStateByName,
      expandedServices,
    });
  });

  const remainingServices = allServiceNames.filter(
    (serviceName) => !expandedServices.has(serviceName),
  );

  if (remainingServices.length === 0) {
    return;
  }

  console.log("Disconnected services:");
  remainingServices.forEach((serviceName, index) => {
    const serviceState = nodeStateByName.get(serviceName) ?? "unknown";
    const serviceLabel = String(serviceName);
    const servicePrefix =
      index === remainingServices.length - 1 ? "└─ " : "├─ ";
    const childPrefix = index === remainingServices.length - 1 ? "   " : "│  ";

    console.log(
      `${servicePrefix}${serviceLabel} ${toStateLabel(serviceState)}`,
    );
    expandedServices.add(serviceName);

    printDependencyEdges({
      serviceName,
      prefix: childPrefix,
      edgesBySource,
      nodeStateByName,
      expandedServices,
    });
  });
};
