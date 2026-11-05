# orderdesk

Order-management API: customers, products, orders/line items, discounts,
CSV export. TypeScript + Express + better-sqlite3 + Vitest.

## Commands

- Install: `npm install`
- Test (required to pass before any change is done): `npm test`
- Typecheck: `npm run typecheck`
- Dev server: `npm run dev` (reads `PORT`, default 3000)

## Conventions

- Money is always integer cents.
- `service.ts` holds logic and throws `ValidationError`/`NotFoundError`/
  `ConflictError` from `src/errors.ts`; `routes.ts` is a thin HTTP shim.
- Atomic multi-row writes use `db.transaction(...)`.
- Tests use an in-memory database (`tests/testUtils.ts`); add both a
  service-level and a route-level test for new behavior.

See `README.md` and `CONTRIBUTING.md` for more detail.
