# [SDLC-TEST] Running total above the order list

**Ticket:** T09
**Labels:** sdlc_test

## Description

When support staff filter the order list down to, say, pending orders, they
often want to know the total dollar value of what they're looking at
without adding it up by hand. Add a running total above the order list.

## Acceptance Criteria

- Above the order list, show "Total: $X.XX" summing the `total_cents` of
  the orders currently displayed on the page (i.e. the current filter and
  page — this does not require a new API call, just summing what the list
  already fetched).
- The total updates when the status filter changes or the page changes.
- When the list is empty, the total reads "Total: $0.00" rather than being
  hidden.
- No changes to the `orderdesk` API are needed for this ticket.
