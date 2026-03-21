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

This executes `src/index.ts`, registers the built in service manifests, and triggers lifecycle events.

### 3) Run tests

```sh
npm run test
```

### 4) Optional quality checks

```sh
npm run lint
npm run format
npm run test:typecheck
```

## Project layout

- `src/registry` core registry types and implementation
- `src/services` concrete service abstractions, manifests, and implementations
- `test/registry` registration, hooks, and getter behavior tests
