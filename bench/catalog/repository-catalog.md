# Repository catalog (benchmark sandbox org)

This is the repository catalog handed to the repo-route stage. It lists five
repositories: the two ground-truth repos used by the golden ticket set, and
three decoys that exist so the router has to actually discriminate rather
than default to "the only real repo."

---

## orderdesk

Order-management REST API for the storefront back office: customers,
products/inventory, orders and line items, discount codes, and a CSV export
of order history. TypeScript, Express, SQLite. Owns all server-side business
rules around pricing, stock levels, and order status transitions. This is
where a ticket about checkout logic, inventory, discounts, order lifecycle,
or the CSV export belongs.

## orderdesk-web

The React front end for the back-office order desk. Talks to `orderdesk`'s
HTTP API; renders the order list, order detail, and the "create a new order"
form. Owns no business logic of its own — it displays and submits what the
API already validates. A ticket about what office staff *see or click* (a
filter, a column, a form field, a confirmation message) belongs here; a
ticket about what the numbers mean or how stock is tracked belongs in
`orderdesk`.

## billing-lib

Shared internal npm package used by several Neumo services to calculate
subscription invoices, prorate mid-cycle plan changes, and format currency
for customer-facing statements. Not wired into `orderdesk` — `orderdesk`'s
discounts and totals are computed inline, not through this library. A ticket
that mentions "invoice," "subscription," "statement," or "proration" belongs
here; a ticket about an *order's* discount or total does not, even though
both involve money.

## infra-config

Terraform and Helm chart definitions for the environments that Neumo's
internal tools (including the order desk) run in: VPC layout, RDS/Aurora
parameter groups, CDN cache rules, and per-environment secrets wiring. No
application code. A ticket about a deploy pipeline, an environment variable,
a TLS certificate, or scaling a service belongs here, never in `orderdesk`
or `orderdesk-web` themselves.

## docs-site

The public documentation site (Docusaurus) for Neumo's customer-facing
product guides and API reference pages. Pulls its API reference content from
a generated OpenAPI spec but does not import or depend on any backend
service's source. A ticket about rewording a help article, fixing a broken
doc link, or publishing a new guide belongs here, not in the services the
guide describes.
