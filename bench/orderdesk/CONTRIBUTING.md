# Contributing

## Layout

Each domain (`customers`, `inventory`, `orders`, `discounts`, `export`) is a
module with up to three files:

- `model.ts` — TypeScript interfaces for the domain's rows and inputs.
- `service.ts` — business logic, talks to `better-sqlite3` directly via
  parameterized queries. No Express types here.
- `routes.ts` — a thin Express `Router` that parses `req`, calls the
  service, and forwards errors to `next(err)`.

`src/db/` holds the schema and connection helper. `src/errors.ts` defines the
`HttpError` hierarchy (`ValidationError` 400, `NotFoundError` 404,
`ConflictError` 409) that `src/app.ts`'s error-handling middleware turns into
JSON responses. `src/validation.ts` holds small reusable input checks.

## Conventions

- All money is integer cents. Never store or compare floats for currency.
- Every mutating service method validates its own input — routes do not
  duplicate validation.
- A service method either returns a fully-formed row (by re-reading after a
  write) or throws one of the `HttpError` subclasses; it never returns
  `null`/`undefined` for a "not found" case.
- Multi-statement writes that must be atomic (e.g. reserving stock for every
  line item of an order) go inside a single `db.transaction(...)` call so a
  failure partway through never leaves partial state.
- Tests live in `tests/`, one file per module plus `*.routes.test.ts` for the
  HTTP layer and `*.service.test.ts` for the business logic directly. Use the
  helpers in `tests/testUtils.ts` to get a fresh in-memory database per test.
- Route tests drive the Express app via `tests/testRequest.ts` (a small
  `supertest`-shaped wrapper around `light-my-request`), not over a real
  socket — see that file's header comment for why. Its chainable API
  (`request(app).get(path).query(...)`, `.post(path).send(body)`, with an
  awaited `.status`/`.body`/`.text`/`.headers`) is intentionally
  supertest-compatible, so route tests read exactly like they would with
  supertest.

## Adding a new field or endpoint

1. Update the table in `src/db/schema.ts` (and the corresponding interface in
   the module's `model.ts`).
2. Add validation in `src/validation.ts` if it's a new shape of check.
3. Implement the service method, re-reading the row before returning it.
4. Wire a route if it needs HTTP exposure.
5. Add both a service-level and a route-level test.
