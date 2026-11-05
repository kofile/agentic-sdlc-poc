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
