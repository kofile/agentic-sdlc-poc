# [SDLC-TEST] Support stacking one percent and one fixed discount

**Ticket:** T07
**Labels:** sdlc_test

## Description

Marketing wants to run a sitewide percent-off promotion at the same time as
letting individual customers redeem a fixed-amount loyalty credit on top of
it. Today an order accepts only one `discount_code`. Extend order creation
to accept multiple discount codes, applied together under a fixed rule.

## Acceptance Criteria

- `POST /orders` accepts `discount_codes: string[]` in addition to (not
  replacing) the existing single `discount_code: string` field; exactly one
  of the two may be present on a given request.
- At most one **percent** discount and one **fixed** discount may be given
  in `discount_codes`. Two percent codes, or two fixed codes, together is
  rejected with a 400.
- When both a percent and a fixed discount are given, the percent discount
  is computed first against the order's subtotal, and the fixed discount is
  then subtracted from what remains (not from the original subtotal). The
  fixed discount still never takes the total below zero.
- Each code in `discount_codes` is independently validated (active, not
  expired, subtotal meets its own minimum against the *original* subtotal)
  the same way a single `discount_code` is validated today; if any code
  fails validation, the whole order is rejected and no stock is reserved.
- The created order's `discount_cents` is the sum of both discounts
  actually applied, and the order records which codes were used.
