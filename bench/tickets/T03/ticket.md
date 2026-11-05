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
