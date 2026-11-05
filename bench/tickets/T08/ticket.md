# [SDLC-TEST] Customer order summary

**Ticket:** T08
**Labels:** sdlc_test

## Description

Support staff looking at a customer record want a quick sense of how much
business that customer represents without paging through their whole order
history by hand.

## Acceptance Criteria

- `GET /customers/:id/summary` returns `{ customer_id, order_count,
  total_spent_cents }`.
- `order_count` and `total_spent_cents` are computed only from the
  customer's `paid` and `fulfilled` orders — `pending` orders haven't been
  paid yet and `cancelled` orders released their stock and shouldn't count
  as business done.
- A customer with no paid/fulfilled orders (including one with only
  pending or cancelled orders) returns `order_count: 0` and
  `total_spent_cents: 0`, not an error.
- Requesting this for an unknown customer id returns 404.
