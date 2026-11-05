# [SDLC-TEST] Sortable order list

**Ticket:** T05
**Labels:** sdlc_test

## Description

The order list currently always returns orders oldest-first. Support staff
triaging the queue want to see the newest orders first, and finance
occasionally wants to sort by order value to spot outliers. Add sorting to
`GET /orders`.

## Acceptance Criteria

- `GET /orders` accepts a `sort` query parameter with these allowed values:
  `created_at_asc` (default, current behavior), `created_at_desc`, and
  `total_desc`.
- An unrecognized `sort` value returns a 400 error rather than silently
  falling back to the default.
- Sorting is applied before pagination, so `page`/`pageSize` paginate the
  sorted result, not the default-ordered one.
- Existing filters (`customer_id`, `status`) continue to work combined with
  `sort`.
