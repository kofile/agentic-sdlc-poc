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
