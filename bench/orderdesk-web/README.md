# orderdesk-web

A thin React client for the `orderdesk` API: browse orders, drill into an
order's line items, walk an order through pay/fulfill/cancel, and create new
orders.

## Requirements

- Node.js >= 20
- A running `orderdesk` API (see `../orderdesk`)

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

By default the client talks to `http://localhost:3000`. Point it elsewhere
with `VITE_API_BASE_URL` (e.g. in a `.env.local` file Vite reads).

## Test

```bash
npm test
```

Tests mock `fetch` directly (see `tests/*.test.tsx` and `tests/client.test.ts`)
so they do not require a running API.

## Structure

- `src/api/types.ts` — response shapes that mirror `orderdesk`'s models.
- `src/api/client.ts` — a small typed fetch wrapper (`api.customers`,
  `api.products`, `api.orders`) that throws `ApiError` on a non-2xx response.
- `src/components/` — `OrderList`, `OrderDetail`, `NewOrderForm`.
- `src/App.tsx` — wires the three views together with no router (plain
  `useState`), since this is deliberately small.
