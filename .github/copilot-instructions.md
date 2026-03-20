# Copilot Instructions

## Destructuring conventions

- Always destructure prop objects inside function bodies.
- This applies everywhere
- Prefer this shape whenever a function receives an object as an argument:

```ts
someFunction: (props) => {
  const { prop1, prop2 } = props;
  // ...
}
```

## TypeScript strictness

- Assume strict TypeScript settings are enabled.
- Do not use `any`.
- Treat unchecked index access as disallowed; handle possibly undefined values explicitly.

## Lint and formatting

- Assume strict linting settings are enabled and code must satisfy them.
- Prefer fixes that align with lint rules instead of suppressing errors.
- Format code with:

```sh
npm run format
```

## ESLint guardrails

- Proactively suggest or add ESLint rules for repeated/common pitfalls in this codebase.
- When proposing a rule, include a short reason tied to a concrete pitfall.

