# [SDLC-TEST] Partial refunds

**Ticket:** T14
**Component:** orderdesk
**Labels:** sdlc_test

## Description

Support occasionally needs to refund part of an order — e.g. one damaged
item out of a three-item order — without cancelling the whole thing. Add
support for partial refunds.

## Acceptance Criteria

- Support can issue a partial refund on an order.
- The refunded amount is reflected on the order.
- Inventory is handled appropriately.
