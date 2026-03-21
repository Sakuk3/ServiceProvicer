# Service Provider

A small TypeScript service registry that wires services by dependency order and runs lifecycle hooks through a single orchestration point.

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
- lifecycle events are triggered through `registry.triggerEvent({ name, payload? })`
- hook failures are collected and returned as structured results

### Event typing model

Lifecycle events are declared in `RegistryEvents` and drive both:

- the accepted `triggerEvent(...)` payload shape
- the allowed hook method signatures in service manifests

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

This executes `examples/demo.ts`, registers the built-in service manifests, and triggers lifecycle events.

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

- `src/registry` core registry types and implementation
- `src/services` concrete service abstractions, manifests, and implementations
- `examples` local runnable demo code excluded from the published package
- `test/registry` registration, hooks, and getter behavior tests

## Package usage

```ts
import {
  authManifest,
  loggerManifest,
  networkManifest,
  notificationManifest,
  storageManifest,
  ServiceRegistry,
} from "service-provider-registry";

const registry = new ServiceRegistry();

registry.registerService(authManifest);
registry.registerService(notificationManifest);
registry.registerService(networkManifest);
registry.registerService(storageManifest);
registry.registerService(loggerManifest);

await registry.triggerEvent({
  name: "login",
  payload: { username: "demo-user" },
});
await registry.triggerEvent({ name: "logout" });
```

## Manifest example

```ts
import { defineService } from "../registry";
import { AbstractLoggerService } from "../AbstractLoggerService";
import type { LoggerService } from "../Logger";

class ExampleStorageService extends AbstractLoggerService {
  public constructor(name: string, loggerService: LoggerService) {
    super(name, loggerService);
  }

  public clearStorage(): Promise<void> {
    this.logger.info("clearStorage", "Storage cleared during logout");
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
