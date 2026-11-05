# orderdesk

A small order-management API: customers, products (inventory), orders with
line items, discount codes, and a CSV order export. Built with TypeScript,
Express, and SQLite (via `better-sqlite3`).

## Requirements

- Node.js >= 20

## Install

```bash
npm install
```

## Run

```bash
npm run dev     # tsx, reloads nothing — restart after edits
npm run build && npm start   # compiled, reads ORDERDESK_DB_PATH (default orderdesk.sqlite)
```

The server listens on `PORT` (default `3000`). On first run it creates the
SQLite file (or `:memory:` if `ORDERDESK_DB_PATH=:memory:`) and applies the
schema automatically — no separate migration step.

## Test

```bash
npm test
```

Tests run against an in-memory SQLite database (no file is created on disk),
so the full suite finishes in well under a minute.

## API surface

| Resource | Routes |
|---|---|
| Customers | `POST/GET /customers`, `GET/PATCH/DELETE /customers/:id` |
| Products | `POST/GET /products`, `GET /products/:id`, `POST /products/:id/adjust-stock`, `PATCH /products/:id/price` |
| Orders | `POST/GET /orders`, `GET /orders/:id`, `POST /orders/:id/pay`, `POST /orders/:id/fulfill`, `POST /orders/:id/cancel` |
| Discounts | `POST/GET /discounts`, `GET /discounts/:code`, `POST /discounts/:code/deactivate` |
| Export | `GET /export/orders?from=&to=&status=` (CSV) |

Every list endpoint accepts `page` and `pageSize` (default 1 / 20, max
`pageSize` 100) and returns `{ items, page, pageSize, total }`.

## Data model

- A **customer** has a unique email.
- A **product** has a unique SKU, a price in cents, and a stock quantity.
- An **order** belongs to one customer, has one or more **line items**
  (each pinned to the product's price at order time), moves through
  `pending -> paid -> fulfilled`, or `-> cancelled` from `pending`/`paid`.
  Cancelling an order restores the stock it reserved.
- A **discount** applies to an order's subtotal as a percent or a fixed
  amount in cents, and may carry a minimum subtotal and an expiry.

## Errors

Every error response is `{ error: string, details?: unknown }` with an
appropriate HTTP status (400 validation, 404 not found, 409 conflict, 500
unexpected).

See `CONTRIBUTING.md` for code conventions and `CLAUDE.md` for the short
version an agent should read first.
