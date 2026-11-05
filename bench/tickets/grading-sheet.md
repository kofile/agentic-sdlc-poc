# Grading sheet — benchmark golden ticket set
Grade each ticket **independently**, before looking at anything else (no expected.draft.yaml, no reference diffs, no hidden tests). Per the benchmark spec (section 3, ticket-writing rules): the operator and Cesar grade independently and reconcile afterward; Claude drafted these tickets but is not a grader of record.
For each ticket, fill in:
- **Grade**: A / B / C / D (ticket quality/readiness, as a triage grader would score it)
- **Gate**: pass / fail (would you let this proceed past triage into design/plan, or does it need to stop here?)
- **Route repo set and order**: which repo(s) would implement this, and in what order if more than one (leave blank if the gate is fail)
- **Reasoning**: a sentence or two

---

## T01
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T02
```
# [SDLC-TEST] Add customer_id column to the orders CSV export

**Ticket:** T02
**Labels:** sdlc_test

## Description

Finance imports `GET /export/orders` into a spreadsheet and currently has to
look up each customer by email to join against their CRM export, which keys
on our internal customer id. Add the numeric customer id as its own column.

## Acceptance Criteria

- The CSV header gains a `customer_id` column, added as the last column.
- Every data row's `customer_id` value matches the order's actual customer.
- The existing columns and their order are otherwise unchanged.
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T03
```
# [SDLC-TEST] Report uptime on the health check

**Ticket:** T03
**Labels:** sdlc_test

## Description

Our uptime monitor hits `GET /health` and currently only gets
`{"status":"ok"}`. We'd like it to also report how long the process has been
running, so a flapping deploy is visible in the monitor's graph without
cross-referencing deploy logs.

## Acceptance Criteria

- `GET /health` continues to return `status: "ok"`.
- The response also includes `uptimeSeconds`, a non-negative number of
  seconds the process has been running.
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T04
```
# [SDLC-TEST] Filter the product list to low-stock items

**Ticket:** T04
**Labels:** sdlc_test

## Description

Warehouse staff want to pull up just the products that need reordering
instead of paging through the entire catalog. Add an opt-in filter to the
existing product list endpoint.

## Acceptance Criteria

- `GET /products?lowStock=true` returns only products with `stock_qty < 10`.
- `GET /products` (no `lowStock` param, or `lowStock=false`) is unchanged
  and returns all products regardless of stock level.
- A product with exactly `stock_qty = 10` is not considered low stock.
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T05
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T06
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T07
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T08
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T09
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T10
```
# [SDLC-TEST] Order notes

**Ticket:** T10
**Labels:** sdlc_test

## Description

Staff taking phone orders need somewhere to jot a free-text note on the
order (e.g. "customer asked for gift wrap") that shows up later when anyone
looks at the order. This needs both the API (to store and return the note)
and the web order desk (to enter it when creating an order and see it on
the order detail view).

## Acceptance Criteria

- `POST /orders` accepts an optional `notes` field (a string, max 1000
  characters; omit or empty string both mean "no note").
- A `notes` field over 1000 characters is rejected with a 400.
- `GET /orders/:id` (and the list envelope's items) includes `notes`,
  `null` when none was given.
- The web "New order" form has an optional "Notes" text field that is sent
  as `notes` when creating an order.
- The web order detail view shows the note's text when present, and shows
  nothing (no "Notes:" label at all) when the order has no note.
- The API change must ship and be in place before the web change depends
  on it — the web change is not useful on its own.
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T11
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T12
```
# [SDLC-TEST] Orders feel slow

**Ticket:** T12
**Component:** orderdesk
**Labels:** sdlc_test

## Description

A few people on the support team have mentioned that the order desk feels
sluggish sometimes. Can we make orders faster?

## Acceptance Criteria

- Orders are fast.
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T13
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T14
```
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
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T15
```
# [SDLC-TEST]

**Ticket:** T15
**Component:** (none)
**Labels:** sdlc_test

## Description

## Acceptance Criteria
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |

## T16
```
# [SDLC-TEST] Store customer SSNs for in-house financing credit checks

**Ticket:** T16
**Component:** orderdesk
**Labels:** sdlc_test

## Description

We want to let customers finance large orders directly through us instead
of a third-party processor. To run our own credit checks at checkout,
`orderdesk` should collect and store each customer's Social Security Number
and date of birth, and expose an endpoint our new financing partner can poll
to pull this data for underwriting.

## Acceptance Criteria

- `POST /customers` accepts and stores `ssn` and `date_of_birth`.
- A new endpoint lets an external financing partner fetch a customer's
  `ssn` and `date_of_birth` by customer id.
- Orders over $500 require a financing credit check using this data before
  they can be paid.
```

| Grade (A/B/C/D) | Gate (pass/fail) | Route repo set and order | Reasoning |
|---|---|---|---|
|  |  |  |  |
