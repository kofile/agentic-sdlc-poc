# Plan 006 — G adapter

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md`, `notes/02-benchmark-spec.md` sections 4,
5.5 and 7, spec 003, and the runbook's per-PR gates.

## Layout

```
bench/harness/src/adapters/g/
  index.ts        gAdapter: ContenderAdapter (id 'G'); version(); run(ctx) orchestrates the pieces below
  ticket.ts       loadTicket(ticketsRoot, id) → { id, title, description, labels: [] }; reads only <id>/ticket.md
  stages.ts       validateGStages(stages) → error string | null (must start at triage, end ≤ open_pr)
  worker.ts       startGraphWorker({ graphRoot, queue, env }) → { proc, stop() } (detached + group kill, waits for "[worker] up")
  gates.ts        driveGates(handle, { team, onApprove }) : polls state every 250 ms, signals decide, yields intervention events
  telemetry.ts    readGraphTelemetry(file, runId) and toStageEvents(lines, requested) (pure)
  paths.ts        GRAPH_ROOT, TICKETS_ROOT resolved from this file's location (repo-relative)
```

- Use `@temporalio/client` `Connection.connect({ address })` + `Client`; `client.workflow.start('pipeline', { taskQueue, workflowId, args: [{ runId, ticket, team, budgetSeconds }] })`;
  `handle.query('state')`; `handle.signal('decide', {...})`; `handle.cancel()`; `handle.result()`.
- `run(ctx)` is an async generator: validate stages → preconditions → start worker → start
  workflow → loop: drive gates (yield intervention events as they happen) and watch the
  telemetry file for the last requested stage's record (poll 500 ms) or the workflow result
  → cancel if still running → stop worker (finally) → read telemetry → yield stage events in
  ladder order.
- Mapping drops harness-owned fields from graph lines (`run_id`, `benchmark_version`,
  `contender`, `contender_version`, `ticket_id`) and omits `cold_start_ms` (graph writes a
  hard 0 it does not measure), so R3a names it a gap. Keep graph's `telemetry_gaps` and pass
  them through.
- Core (R5): in `executeRun`, `if ('type' in ev && ev.type === 'intervention') store.insertIntervention({ run_id, ...ev })`
  else the existing stage path. Extend `types.ts` with `InterventionEvent` and
  `AdapterEvent = StageEvent | InterventionEvent`.
- `package.json`: `@temporalio/client` 1.25.0; script `test:g` = `BENCH_G_E2E=1 vitest run tests/g.e2e.test.ts`.
  The default `npm test` must stay green with no Temporal (the e2e test skips itself unless
  `BENCH_G_E2E=1`).
- README: usage, env vars (`BENCH_G_TEAM`, `BENCH_G_BUDGET_SECONDS`, `GRAPH_REASONING`,
  `TEMPORAL_ADDRESS`), prerequisites (temporal-dev, graph `npm ci`, the execute-host image),
  and the scripted-approval rule.
- D13 row: "Scripted gate approvals in benchmark mode are logged in `interventions` with kind
  `scripted_approval` and do not count toward the intervention metric or `assisted`", graded
  three ways, with evidence `specs/006-g-adapter/spec.md`.

## Verification (orchestrator re-runs)

`npm ci && npm run build && npm test` in `bench/harness`. Then, with temporal-dev up and stray
workers killed: `BENCH_G_TEAM=default npm run bench -- run --contender G --ticket T01 --rep 1 --stages triage..open_pr --seed-order 1`,
then `bench report`. Check: six stage records, one `scripted_approval`, and no `worker.ts`
process left afterwards. Also run `npm run test:g`. Run `--stages triage..route` and confirm
the workflow is cancelled (two records, `temporal workflow describe` status Canceled or the
equivalent). Run the canary grep on the diff.
