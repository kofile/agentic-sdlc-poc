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
