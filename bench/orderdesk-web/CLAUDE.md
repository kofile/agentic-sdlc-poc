# orderdesk-web

React client for the orderdesk API. Vite + React 18 + Vitest + Testing
Library.

## Commands

- Install: `npm install`
- Test (must pass before any change is done): `npm test`
- Typecheck: `npm run typecheck`
- Dev server: `npm run dev` (talks to `VITE_API_BASE_URL`, default
  `http://localhost:3000`)

## Conventions

- `src/api/types.ts` must stay in sync with `../orderdesk`'s response
  shapes — it is the client's half of the contract.
- `src/api/client.ts` is the only place that calls `fetch`; components call
  `api.*` and catch `ApiError`.
- Tests mock `global.fetch`; do not spin up a real server in tests.
