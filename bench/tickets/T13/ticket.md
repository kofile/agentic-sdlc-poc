# [SDLC-TEST] Let customers edit an order after checkout

**Ticket:** T13
**Component:** orderdesk
**Labels:** sdlc_test

## Description

Customers sometimes realize they ordered the wrong quantity right after
paying and want it fixed without starting a new order and cancelling the
old one.

## Acceptance Criteria

- Once an order has been paid, the customer can change the quantity of a
  line item and the order's total updates to match.
- An order's financial details are locked as soon as it has been paid and
  must never change afterward, to keep accounting records consistent with
  what was charged.
- Changing a quantity should restock or reserve inventory correctly.
