# [SDLC-TEST] Single-day shorthand for the orders export

**Ticket:** T06
**Labels:** sdlc_test

## Description

Finance runs the orders export once a day for "yesterday's orders" and
currently has to compute both an ISO start and end timestamp to pass as
`from`/`to`. Add a shorthand that takes a single calendar date.

## Acceptance Criteria

- `GET /export/orders?date=YYYY-MM-DD` returns every order created on that
  calendar date (UTC), from `00:00:00.000` through `23:59:59.999` inclusive.
- `date` can be combined with `status`, but returns a 400 if combined with
  `from` or `to` (pick one approach, not both).
- An invalid `date` value (not a real calendar date, or wrong format)
  returns a 400.
