# [SDLC-TEST] Add a customer's orders endpoint

**Ticket:** T01
**Labels:** sdlc_test

## Description

Office staff currently have to call `GET /orders?customer_id=<id>` to see a
customer's order history. That works, but every other "show me this
customer's related records" lookup in the API hangs off the customer's own
URL. Add a route that does the same thing under `/customers/:id/orders`.

## Acceptance Criteria

- `GET /customers/:id/orders` returns the same paginated envelope
  (`items`, `page`, `pageSize`, `total`) as `GET /orders?customer_id=<id>`,
  scoped to that customer.
- It supports the same `page` and `pageSize` query parameters as the
  existing orders list.
- Requesting this for a customer id that does not exist returns 404, not an
  empty list.
