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
- lifecycle events are triggered through `registry.triggerEvent(eventName)`
- hook failures are collected and returned as structured results

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
import { ServiceRegistry, defineService } from "service-provider-registry";

const registry = new ServiceRegistry();
const logger = defineService({
  name: "logger",
  dependencies: [],
  factory: () => ({
    info: (message: string) => message,
  }),
  hooks: {
    login: [() => undefined],
  },
});

registry.registerService(logger);
```

## Pre-publish checklist

- Confirm package metadata in `package.json` (`name`, `repository`, `bugs`, `homepage`)
- Run `npm run verify`
- Run `npm run pack:check` and inspect tarball contents
- Ensure `git status` is clean
- Publish with `npm publish --access public`
