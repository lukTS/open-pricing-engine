# ADR 0004: REST API wrapper

- **Status:** Proposed
- **Date:** 2026-11-12
- **Deciders:** Core maintainers

## Context

Until v0.5 the engine is reachable only as a TypeScript library: to price an
item, the caller has to run Node and import `open-pricing-engine`. Many systems
that need prices are not JavaScript — a PHP ERP, a Python service, a shell
script. For them, embedding Node is a heavy and unnatural dependency.

We need to expose the engine over HTTP. The risk is that the HTTP layer grows
its own logic: its own request schemas, its own rounding, its own error texts.
Every such copy would drift from the core and produce two answers to the same
question. The API must therefore stay a **thin wrapper**, and the core must
remain the single source of truth for both prices and validation.

A second, independent problem: the API has to translate errors into HTTP
statuses. Today the core throws a plain `Error` for caller mistakes (unknown
rule, no effective price list) and for internal bugs alike, so the only way to
tell them apart is to parse the message text. Messages are for humans and may be
reworded; an HTTP status must not depend on them.

## Decision

Add a new workspace package `packages/api` — a Fastify server that loads one
pricing config at startup and answers `POST /calculate` with exactly the
`CalculationResult` the library returns. Add `PricingError` with
machine-readable codes to the core, so the API maps errors by `code`, never by
message.

### 1. Scope and package

- New workspace package **`packages/api`**, npm name `open-pricing-engine-api`,
  **`"private": true`** in v0.6 — it is not published to npm. A server is
  shipped as a **Docker image** (§8), not as a library; publishing to npm would
  mean a CLI and a second public API to support. Revisit if someone asks.
- Depends on the core via `"open-pricing-engine": "workspace:*"`, plus
  `fastify` (v5) and `zod` (same range as the core, see §10).
- **Thin wrapper.** The API passes the request body straight to
  `engine.calculate()`. It defines no request schemas of its own: validation
  already lives in the core, and a second copy would drift.

### 2. Endpoints

| Method | Path         | Body               | Success                         |
| ------ | ------------ | ------------------ | ------------------------------- |
| `GET`  | `/health`    | —                  | `200 { "status": "ok" }`        |
| `POST` | `/calculate` | `CalculationInput` | `200` — the `CalculationResult` |

- `date` travels as an ISO string — the core already accepts `Date | string`.
- The success body is the `CalculationResult` **as is**: no envelope, no renamed
  fields, no rounding. A test asserts `toStrictEqual(engine.calculate(input))`.
- No batch endpoint, no `GET /rules` (non-goals, §11).

### 3. The config lives on the server

- Loaded **once at startup** from a JSON file whose path is `PRICING_CONFIG`.
  Same shape as `PricingEngineConfig`, so both `rules` and `priceLists` work.
- **Fail fast:** a missing variable, a missing file, invalid JSON or an invalid
  config stops the process with a non-zero exit code and a message naming the
  path — before the server listens. A server that starts with a broken price
  list is worse than one that does not start.
- **Clients never send prices.** Whoever runs the server controls the prices; a
  client that could post its own config could price its own orders.
- No hot reload: changing prices = restarting the container (non-goal).

### 4. Error model

Every error has the same envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "issues": [{ "path": "dimensions.width", "message": "Width must be positive" }]
  }
}
```

| Source                                                                                     | Status                   | `code`                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------- |
| `ZodError` (input or per-strategy dimensions)                                              | 400                      | `VALIDATION_ERROR` + `issues` (`path` dot-joined)          |
| `PricingError` from the core (§5)                                                          | 422                      | its own `code` (`UNKNOWN_RULE`, `NO_EFFECTIVE_PRICE_LIST`) |
| Fastify client errors (malformed JSON, empty body, unsupported media type, body too large) | their `statusCode` (4xx) | `BAD_REQUEST`                                              |
| Unknown route                                                                              | 404                      | `NOT_FOUND`                                                |
| Anything else                                                                              | 500                      | `INTERNAL_ERROR`, generic message                          |

- **Why 422 and not 404 for an unknown rule:** the rule is a field in the body,
  not a resource in the URL. The request is well-formed but cannot be
  processed.
- **Why 500 hides the message:** an unexpected error is a bug; its text and
  stack may leak internals. It is logged in full and answered with
  `"Internal server error"`.
- **Why codes and not messages:** messages are for humans and may be reworded;
  `code` is the contract for machines. Rewording a message must never change an
  HTTP status.

### 5. Core change: `PricingError`

```ts
export type PricingErrorCode = 'UNKNOWN_RULE' | 'NO_EFFECTIVE_PRICE_LIST';

export class PricingError extends Error {
  readonly code: PricingErrorCode;
  // constructor(code, message) — sets name = 'PricingError'
}
```

- Thrown for the two **caller-caused** runtime errors: unknown rule and no
  effective price list.
- **Messages unchanged, byte for byte** → every existing
  `toThrow('Unknown rule: ...')` test passes untouched, and `instanceof Error`
  is still true. Additive → core minor **0.6.0**.
- The unreachable internal guards (`/* v8 ignore */`) stay plain `Error` —
  reaching them means a bug, which correctly maps to 500.
- Config errors stay `ZodError` at construction time — the API never sees them
  at request time (fail fast, §3).
- New module `src/errors.ts`, exported through `index.ts`.
- Target is ES2022, so `class extends Error` keeps a working `instanceof`
  natively — the old `Object.setPrototypeOf` workaround was only needed when
  compiling to ES5.

### 6. Structure: dependency injection and a composition root

```
packages/api/
├── src/
│   ├── app.ts       — buildApp(engine, options?) → FastifyInstance: routes + error handlers; no I/O, no listen
│   ├── config.ts    — loadEngine(path) → PricingEngine: read file, JSON.parse, new PricingEngine
│   └── server.ts    — composition root: env → loadEngine → buildApp → listen; signal handling
├── tests/
│   ├── app.test.ts
│   ├── config.test.ts
│   └── fixtures/    — valid and invalid config files
├── examples/pricing.json
├── Dockerfile
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

- **`buildApp` receives the engine** instead of creating it (dependency
  injection). Tests build an engine inline and call `app.inject()` — no network,
  no ports, no files.
- The parameter type is `Pick<PricingEngine, 'calculate'>` — depend on the
  smallest interface you use. It also lets the 500 test pass a stub whose
  `calculate` throws a `TypeError`.
- **`server.ts` is the composition root** — the only file touching env, files,
  network and process signals. It is excluded from coverage and verified by a
  manual and a Docker smoke test.
- `options` are Fastify server options: `server.ts` passes `{ logger: true }`
  (pino, JSON lines); tests pass nothing, so logs stay quiet.

### 7. Runtime settings

| Variable         | Default     | Meaning                                         |
| ---------------- | ----------- | ----------------------------------------------- |
| `PRICING_CONFIG` | — required  | Path to the JSON pricing config                 |
| `PORT`           | `3000`      | Listen port                                     |
| `HOST`           | `127.0.0.1` | Listen address; the Docker image sets `0.0.0.0` |

- **Loopback by default:** running it on a laptop must not expose it to the
  local network by accident. The container opts in to `0.0.0.0`, where the
  network is isolated anyway.
- **Graceful shutdown:** `SIGINT` / `SIGTERM` → `app.close()` → exit 0.
  `docker stop` sends `SIGTERM`; without a handler the container is killed after
  10 seconds.

### 8. Docker image

- Multi-stage `packages/api/Dockerfile`; build context = **repository root** (it
  needs the workspace and the core):
  `docker build -f packages/api/Dockerfile -t open-pricing-engine-api .`
- **Build stage:** `pnpm install --frozen-lockfile` → build core and api →
  `pnpm deploy --filter open-pricing-engine-api --prod <dir>` (a self-contained
  folder with production dependencies only). pnpm 10 requires
  `inject-workspace-packages=true` or the `--legacy` flag for `pnpm deploy`.
- **Runtime stage:** `node:22-alpine`, runs as the non-root `node` user,
  `ENV HOST=0.0.0.0`, `EXPOSE 3000`, `HEALTHCHECK` with
  `wget -qO- http://127.0.0.1:3000/health`, `CMD ["node", "dist/server.js"]`.
- **The config is not baked into the image.** It is mounted read-only, so one
  image serves any price list:
  `docker run -p 3000:3000 -v ./pricing.json:/config/pricing.json:ro -e PRICING_CONFIG=/config/pricing.json open-pricing-engine-api`
- `.dockerignore`: `node_modules`, `**/dist`, `coverage`, `.git`, `.notes`.
- CI builds the image on every PR (no push) so a broken Dockerfile is caught
  early.

### 9. Versioning and release

- **Lockstep versioning:** core and api always share one version — both become
  **0.6.0**, one tag `v0.6.0`. One number tells you what works together (the
  "fixed" mode of Babel / Jest monorepos).
- npm: only the core is published (0.6.0, with `PricingError`). The api stays
  private.
- One `CHANGELOG.md`; entries are prefixed with the package: `**core:**` /
  `**api:**`.

### 10. Monorepo wiring (known pitfalls)

- **The api imports `open-pricing-engine` through its package exports →
  `packages/core/dist`.** Without a built core, typecheck and tests fail. Fix
  both sides:
  - **Typecheck:** TypeScript project references — `"composite": true` in the
    core tsconfig, `"references": [{ "path": "../core" }]` in the api tsconfig,
    and the root script becomes `tsc -b packages/core packages/api` (`tsc -b`
    builds the core first).
  - **Tests:** an alias in `packages/api/vitest.config.ts` —
    `'open-pricing-engine'` → `../core/src/index.ts`. Tests run against the core
    source; no build.
- The root `vitest.config.ts` already uses `projects: ['packages/*']` → the api
  is picked up automatically. Its coverage `include` is `packages/*/src/**` →
  `packages/api/src/server.ts` is added to `exclude`.
- **`instanceof ZodError` across packages:** the api must import `ZodError` from
  the **same** zod instance the core throws. `zod` is added to the api with the
  same range as the core (`^4.4.3`) — pnpm links one copy. The 400 test proves
  it; if it ever fails with a 500, two zod copies are installed.
- CI keeps its steps: `pnpm typecheck` (root script now covers the api),
  `pnpm test`, and `pnpm build` (`pnpm -r build` picks up the api's own `build`
  script).

### 11. Non-goals for v0.6

- **Authentication, rate limiting, CORS, TLS.** The service is internal; run it
  behind a gateway or reverse proxy. The README says plainly: do not expose it
  to the internet as is.
- **OpenAPI / Swagger UI** — backlog.
- **`GET /rules` introspection** — backlog.
- **Batch / quote endpoint** — arrives together with multi-line quotes, if ever.
- **Hot reload, several configs per server, uploading a config over HTTP.**
- **Publishing** the api to npm or the image to a registry.
- **Rounding or formatting numbers** — the JSON is exactly what the core
  returns.

### Alternatives considered

- **Own request schemas in the API** (Fastify JSON Schema or a second Zod
  schema). Faster rejection of bad input, but a second copy of the validation
  rules that would drift from the core. Rejected: the core already validates
  every input and produces precise Zod issues.
- **Config sent by the client with every request.** Makes the server stateless,
  but lets any client set its own prices. Rejected (§3).
- **Mapping errors by message text** (`message.startsWith('Unknown rule')`).
  No core change needed, but a reworded message would silently turn a 422 into
  a 500. Rejected in favour of `PricingError.code` (§5).
- **404 for an unknown rule.** Rejected: the rule is a body field, not a URL
  resource (§4).
- **Publishing the api to npm.** Rejected for v0.6: a server is consumed as an
  image, and an npm package would add a CLI and a second public API (§1).
- **Independent versions for core and api.** Rejected: lockstep gives one number
  that tells what works together (§9).

## Consequences

**Positive**

- Non-JavaScript systems can price items over HTTP without embedding Node.
- The API holds no pricing logic and no validation of its own, so it cannot
  disagree with the library: the HTTP body is exactly the `CalculationResult`.
- Clients get a stable, machine-readable error contract (`code` + HTTP status)
  that survives rewording of messages.
- `PricingError` is useful to library users too: they can tell caller mistakes
  from bugs without parsing messages. The change is additive — v0.6.0 is a
  clean minor for the core.
- Dependency injection keeps `buildApp` fully testable with `app.inject()`; all
  I/O is isolated in a small composition root.
- A broken config is caught at startup, not on the first request.

**Negative / trade-offs**

- A second package in the monorepo: project references, a Vitest alias and a
  shared zod instance must be kept in place (§10).
- No authentication or rate limiting — the service must run behind a gateway;
  exposing it directly is unsafe.
- Changing prices requires a restart; there is no hot reload.
- `server.ts` is excluded from coverage and verified only by smoke tests.
- `err.name` for the two caller errors changes from `'Error'` to
  `'PricingError'`; code that compared `name` (rather than `instanceof` or the
  message) would notice.
- Results stay unrounded in JSON, exactly as the library returns them; rounding
  remains the client's job.
