# [SDLC-TEST] Live discount preview before placing an order

**Ticket:** T11
**Labels:** sdlc_test

## Description

Staff entering a phone order currently only find out whether a discount
code is valid (and how much it saves) after they submit the whole order —
if it fails, they have to re-enter everything. Add a preview the web form
can call before submitting, and wire the form up to it.

## Acceptance Criteria

- New API endpoint `GET /discounts/:code/preview?subtotal_cents=N` returns
  `{ valid: boolean, discount_cents: number, reason: string | null }`.
  - When the code is active, not expired, and `subtotal_cents` meets its
    minimum: `valid: true`, `discount_cents` is the amount it would save
    (same math as order creation today), `reason: null`.
  - When the code exists but fails a check (inactive, expired, below
    minimum): `valid: false`, `discount_cents: 0`, and `reason` is a short
    human-readable explanation of which check failed.
  - When the code does not exist at all: respond `200` with
    `{ valid: false, discount_cents: 0, reason: "unknown discount code" }`
    rather than a 404 — this is a preview, not a lookup, and the form needs
    a normal response to show inline.
- This endpoint never creates an order or reserves stock.
- In the "New order" form, when every line item has a valid positive
  product id and quantity, look up each product (`GET /products/:id`) to
  compute the order's subtotal client-side, the same way the API would
  (sum of `price_cents * quantity`). If any product id doesn't resolve,
  treat the subtotal as unknown and skip the preview silently (no error
  shown for this — the user hasn't finished entering valid line items yet).
- When a subtotal is known and a discount code is entered (non-empty,
  trimmed), call the preview endpoint and show a line: "Discount preview:
  -$X.XX" when `valid` is true, or "Discount preview: <reason>" when
  `valid` is false. Show nothing when the discount code field is empty.
- The preview is advisory only: submitting the order still re-validates the
  discount server-side exactly as it does today, via the existing
  `discount_code` field on `POST /orders`.
