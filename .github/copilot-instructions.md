# Copilot Instructions

## Destructuring conventions

- Always destructure prop objects inside function bodies.
- This applies everywhere
- Prefer this shape whenever a function receives an object as an argument:

```ts
someFunction: (props) => {
  const { prop1, prop2 } = props;
  // ...
};
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

## Code quality and style

- Prefer small, single-purpose functions and keep control flow straightforward.
- Favor early returns over deep nesting to improve readability.
- Use descriptive, domain-based names; avoid vague names like `data`, `item`, or `value` when a concrete name is possible.
- Keep module boundaries clear: shared types in dedicated type files, public exports via index/barrel files, and avoid circular imports.
- Avoid hidden side effects in library entry points; keep package exports safe to import.
- Model failures explicitly with typed results or clear error classes/messages; never swallow errors silently.
- Add comments only for non-obvious intent, invariants, or tradeoffs; keep comments short and maintainable.
- Treat tests as behavior documentation: cover happy path, edge cases, and failure paths for changed logic.
- Prefer focused, minimal diffs that preserve behavior unless a behavior change is explicitly requested.

## Publication readiness

- Treat all publication requests as security-sensitive.
- Before suggesting `npm publish`, require a clean pre-publish sequence and explicit tarball review.
- Prefer deterministic publish flows (`verify` -> `pack:check` -> publish) over ad-hoc commands.

## Public data safety

- Always check for potentially sensitive files before publication-related changes (for example: `.env*`, private keys, IDE-local configs, credentials in docs/examples).
- If potential secrets are found, stop and surface them clearly with file paths and remediation steps.
- Never generate real credentials, tokens, or secrets in examples; use obvious placeholders.
- Ensure ignore rules protect local/private artifacts from accidental commits and publish payloads.

## Package metadata requirements

- Ensure publish metadata is complete and non-placeholder before release guidance:
  - `name`
  - `version`
  - `description`
  - `license`
  - `repository`
  - `bugs`
  - `homepage`
  - `files` / `exports` / `types` entries when relevant
- Flag placeholder values (for example `your-org`, `TODO`, empty strings) and request correction before publication.

## Release validation commands

- For publication tasks, run and report results of release checks when possible:

```sh
npm run verify
npm run pack:check
npm audit --audit-level=high
```

- If any check fails, prioritize fixing the failure before additional feature work.

## CI and security alignment

- Keep local publication guidance aligned with CI workflows so local checks and CI gates validate the same quality bar.
- Prefer adding or updating CI checks instead of relying on one-off manual verification.
- For repeated test hygiene issues (focused/skipped tests), recommend lint guardrails with a concrete pitfall-based reason.

## Pre-publish response behavior

- When asked to "make publish ready", respond with a checklist-first plan and then implement in small verifiable steps.
- End with a concise "remaining manual actions" list (for example: final package name, real repository URLs, npm ownership).
- Avoid claiming release readiness until verification commands and package dry-run output are confirmed.
