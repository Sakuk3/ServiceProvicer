# Service Provider

A small TypeScript service registry that wires services by dependency order and runs lifecycle hooks through a single orchestration point.

The published package exposes registry primitives only. Concrete services live in consumer code (this repo keeps sample services in `examples/demo/services`).

## Why this repo exists

This project is a focused reference for building modular services that:

- register with a typed manifest
- resolve dependencies automatically
- expose a consistent lifecycle hook model
- stay easy to test as the system grows

The goal is to keep service composition explicit and predictable while keeping each service isolated.

## How it works

- `ServiceRegistry` stores services in `waiting` and `ready` states
- service manifests define `name`, `dependencies`, `hooks`, and `factory`
- dependencies are resolved before a service instance is created
- registering a service that introduces a cycle throws `ServiceRegistryCircularDependencyError`
- lifecycle events are triggered through `registry.triggerEvent({ name, payload? })`
- hook failures are collected and returned as structured results
- dependency graph data is available via `registry.getDependencyGraph()` for custom visualizers
- `visualizeServiceDependencyGraph(...)` prints a readable dependency graph in the console

When cycle detection fails, `registerService(...)` throws with a stable message and
includes a `cyclePath` property to aid diagnostics, for example:
`Auth -> Network -> Auth`.

### Event and service typing model

Lifecycle events are declared in `RegistryEvents`, and services are declared in `Services` via interface extension (module augmentation). Together they drive:

- the accepted `triggerEvent(...)` payload shape
- the allowed hook method signatures in service manifests

Repo-local example: `examples/demo/demoTypeExtensions.ts` augments both maps for the demo.

```ts
interface RegistryEvents {
  login: { username: string };
  logout: undefined;
}

await registry.triggerEvent({
  name: "login",
  payload: { username: "demo-user" },
});

await registry.triggerEvent({ name: "logout" });

visualizeServiceDependencyGraph(registry.getDependencyGraph());
```

Example output from `examples/demo.ts`:

```text
Service dependency graph (single view, service -> dependency)
├─ Auth [ready]
│  ├─> Logger [ready]
│  └─> Network [ready]
│     ├─> Logger [ready] [ref]
│     └─> Storage [ready]
│        └─> Logger [ready] [ref]
├─ Notification [ready]
│  └─> Logger [ready] [ref]
└─ Audit [ready]
   ├─> Logger [ready] [ref]
   └─> Storage [ready] [ref]
```

## Getting started

### 1) Install dependencies

```sh
npm install
```

### 2) Run the example bootstrap

```sh
npm run start
```

This executes `examples/demo.ts`, registers demo-local manifests from `examples/demo/services`, and triggers lifecycle events.

### 3) Build distributable files

```sh
npm run build
```

Compiled output is written to `dist/`.

### 4) Run tests

```sh
npm run test
```

### 5) Optional quality checks

```sh
npm run lint
npm run format
npm run test:typecheck
```

### 6) Public release checks

```sh
npm run verify
npm run pack:check
```

`npm run pack:check` prints the exact tarball content so you can confirm no private files are included.

## Project layout

- `src/registry` core registry types and implementation (published)
- `examples/demo/services` runnable sample service implementations/manifests (not published)
- `examples/demo` demo wiring (`demo.ts`, hook orchestration, type extensions)
- `test/registry` registration, hooks, and getter behavior tests

## Package usage

```ts
import {
  defineService,
  ServiceRegistry,
  type Service,
  type Services,
  visualizeServiceDependencyGraph,
} from "service-provider-registry";

interface LoggerService extends Service {
  info: (scope: string, ...args: unknown[]) => void;
}

declare module "service-provider-registry/registry" {
  interface Services {
    Logger: LoggerService;
  }
}

const loggerManifest = defineService({
  name: "Logger",
  dependencies: [] as const,
  factory: () => {
    return {
      name: "Logger",
      info: (_scope: string, ..._args: unknown[]) => {},
    } satisfies Services["Logger"];
  },
});

const registry = new ServiceRegistry();

registry.registerService(loggerManifest);

await registry.triggerEvent({
  name: "login",
  payload: { username: "demo-user" },
});
await registry.triggerEvent({ name: "logout" });

visualizeServiceDependencyGraph(registry.getDependencyGraph());
```

## Manifest example

```ts
import {
  AbstractService,
  defineService,
  type Service,
} from "service-provider-registry";

interface LoggerService extends Service {
  info: (scope: string, ...args: unknown[]) => void;
}

interface StorageService extends Service {
  clearStorage: () => Promise<void>;
}

declare module "service-provider-registry/registry" {
  interface Services {
    Logger: LoggerService;
    Storage: StorageService;
  }
}

class ExampleStorageService extends AbstractService implements StorageService {
  public constructor(name: string, loggerService: LoggerService) {
    super(name);
    this.loggerService = loggerService;
  }

  private readonly loggerService: LoggerService;

  public clearStorage(): Promise<void> {
    this.loggerService.info("clearStorage", "Storage cleared during logout");
    return Promise.resolve();
  }
}

const serviceName = "Storage";

export const storageManifest = defineService({
  name: serviceName,
  dependencies: ["Logger"],
  hooks: {
    logout: { method: "clearStorage", retry: true },
  },
  factory: (deps) => {
    const { Logger } = deps;
    return new ExampleStorageService(serviceName, Logger);
  },
});
```

## Pre-publish checklist

- Confirm package metadata in `package.json` (`name`, `repository`, `bugs`, `homepage`)
- Run `npm run verify`
- Run `npm run pack:check` and inspect tarball contents
- Ensure `git status` is clean
- Publish with `npm publish --access public`
