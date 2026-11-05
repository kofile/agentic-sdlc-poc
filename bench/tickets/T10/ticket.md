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
