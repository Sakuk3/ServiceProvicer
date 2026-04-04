import { describe, expect, it, vi } from "vitest";
import {
  type ServiceDependencyGraph,
  visualizeServiceDependencyGraph,
} from "../../src";

const toLogMessages = (mockCalls: readonly unknown[][]): string[] => {
  return mockCalls.map((callArgs) => {
    const [message] = callArgs as [unknown, ...unknown[]];
    return String(message);
  });
};

describe("visualizeServiceDependencyGraph", () => {
  it("prints an explicit empty graph message", () => {
    const graph: ServiceDependencyGraph = {
      nodes: [],
      edges: [],
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    visualizeServiceDependencyGraph(graph);

    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      "Service dependency graph (single view, service -> dependency)",
    );
    expect(logSpy).toHaveBeenNthCalledWith(2, "  (none)");
    logSpy.mockRestore();
  });

  it("prints dependency states, missing dependencies, and non-ready flags", () => {
    const graph: ServiceDependencyGraph = {
      nodes: [
        {
          name: "Web",
          state: "ready",
          dependencies: ["Auth", "Logger"],
          missingDependencies: [],
        },
        {
          name: "Auth",
          state: "waiting",
          dependencies: ["Database"],
          missingDependencies: ["Database"],
        },
        {
          name: "Logger",
          state: "ready",
          dependencies: [],
          missingDependencies: [],
        },
      ],
      edges: [
        {
          from: "Web",
          to: "Auth",
          isRegistered: true,
          isReady: false,
        },
        {
          from: "Web",
          to: "Logger",
          isRegistered: true,
          isReady: true,
        },
        {
          from: "Auth",
          to: "Database",
          isRegistered: false,
          isReady: false,
        },
      ],
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    visualizeServiceDependencyGraph(graph);

    const calls = toLogMessages(logSpy.mock.calls);

    expect(calls).toContain("└─ Web [ready]");
    expect(calls).toContain("   ├─> Auth [waiting] [not-ready]");
    expect(calls).toContain("   │  └─> Database [missing]");
    expect(calls).toContain("   └─> Logger [ready]");
    expect(calls).not.toContain("Disconnected services:");
    logSpy.mockRestore();
  });

  it("prints all nodes when there are no roots and marks repeated edges as references", () => {
    const graph: ServiceDependencyGraph = {
      nodes: [
        {
          name: "A",
          state: "ready",
          dependencies: ["B"],
          missingDependencies: [],
        },
        {
          name: "B",
          state: "ready",
          dependencies: ["A"],
          missingDependencies: [],
        },
      ],
      edges: [
        {
          from: "A",
          to: "B",
          isRegistered: true,
          isReady: true,
        },
        {
          from: "B",
          to: "A",
          isRegistered: true,
          isReady: true,
        },
      ],
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    visualizeServiceDependencyGraph(graph);

    const calls = toLogMessages(logSpy.mock.calls);

    expect(calls).toContain("├─ A [ready]");
    expect(calls).toContain("└─ B [ready]");
    expect(calls).toContain("│  └─> B [ready]");
    expect(calls).toContain("│     └─> A [ready] [ref]");
    expect(calls).toContain("   └─> A [ready] [ref]");
    logSpy.mockRestore();
  });

  it("prints disconnected services when roots do not reach all nodes", () => {
    const graph: ServiceDependencyGraph = {
      nodes: [
        {
          name: "Root",
          state: "ready",
          dependencies: [],
          missingDependencies: [],
        },
        {
          name: "X",
          state: "failed",
          dependencies: ["Y"],
          missingDependencies: [],
        },
        {
          name: "Y",
          state: "waiting",
          dependencies: ["X"],
          missingDependencies: [],
        },
      ],
      edges: [
        {
          from: "X",
          to: "Y",
          isRegistered: true,
          isReady: false,
        },
        {
          from: "Y",
          to: "X",
          isRegistered: true,
          isReady: false,
        },
      ],
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    visualizeServiceDependencyGraph(graph);

    const calls = toLogMessages(logSpy.mock.calls);

    expect(calls).toContain("└─ Root [ready]");
    expect(calls).toContain("Disconnected services:");
    expect(calls).toContain("├─ X [failed]");
    expect(calls).toContain("│  └─> Y [waiting] [not-ready]");
    expect(calls).toContain("│     └─> X [failed] [not-ready] [ref]");
    expect(calls).toContain("└─ Y [waiting]");
    logSpy.mockRestore();
  });
});
