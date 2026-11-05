# Spec 006 — G adapter for the bench harness (TASK-0018)

Implements: TASK-0018; `notes/02-benchmark-spec.md` section 7 (one adapter per contender,
uniform stage-run record, no contender-specific logic in the core), section 4 rows "Human
pauses" and "Hands-off", section 5.5 "Human interventions"; spec 003 (harness, adapter
contract R2, no-silent-zeros R3a); runbook ruling C2 (`bench/harness/`).

## Problem

`bench run --contender G` does not exist. The harness can run only its `stub` contender.
G is a Temporal workflow (`graph/`, workflow type `pipeline`) that writes one telemetry line
per stage, plus one per gate outcome, to `graph/.run-state/telemetry.jsonl`, and pauses at
human gates until it receives a `decide` signal.

## Requirements

- **R1 (AC #1)** A `G` adapter is registered in `bench/harness/src/adapters/registry.ts`.
  `bench run --contender G --ticket <Tnn> --rep <n> --stages triage..<to> --seed-order <n>`
  runs one graph workflow and yields one stage-run record per executed stage in the
  requested range. `--stages` must start at `triage`, because G has no entry point mid-ladder;
  any other start fails the run with a one-line error. Supported ends: `triage` through
  `open_pr`. `validate`/`review` are not G stages yet, and asking for them fails with a
  one-line error.
- **R2 (AC #1)** Running the graph. Per run the adapter:
  (a) builds the ticket `{ id, title, description, labels: [] }` from
  `bench/tickets/<Tnn>/ticket.md` (the H1 is the title, the rest is the description). It opens
  **only** that file in the ticket directory.
  (b) Spawns one graph worker (`node --import tsx src/workflow/worker.ts` in `graph/`) as a
  detached process-group leader, with a per-run `TEMPORAL_TASK_QUEUE`. `GRAPH_REASONING` and
  `TEMPORAL_ADDRESS` pass through from the harness environment. The adapter waits for the
  worker's `[worker] up` line and kills the whole group on every exit path, the same pattern
  as TASK-0043's integration fix.
  (c) Starts workflow `pipeline` with `workflowId = run_id = graph runId`, the ticket, the
  team (R3), and `budgetSeconds` (env `BENCH_G_BUDGET_SECONDS`, default 60).
  (d) After the last requested stage has produced its record, **cancels** the workflow, so a
  `--stages triage..route` run does not pay for design and later stages. Otherwise it waits
  for the result.
  (e) Preconditions fail fast with one-line errors: Temporal unreachable, `graph/node_modules`
  missing, or the worker not up within 30 s.
- **R3 (AC #2)** Gates are driven by the team policy. The team comes from env `BENCH_G_TEAM`
  (`auto` | `default` | `strict`, default `auto`); the adapter passes it to the workflow,
  which loads `graph/teams/<team>.json` itself. While the workflow runs, the adapter polls the
  `state` query. Each time it reports `waiting: { gate, round }`, the adapter acts as the
  benchmark's **scripted approver** (spec section 4, "Human pauses"): it sends `decide` with
  `{ gate, round, approved: true, by: 'bench-scripted' }` after a 0 s delay.
- **R4 (AC #2)** Recording. Every scripted approval is written to the `interventions` table
  as `{ run_id, stage: <gate's stage>, at, kind: 'scripted_approval', note: '<gate>#<round> team=<team>' }`.
  Per spec section 5.5 the `interventions` count on a stage-run record counts **unscripted**
  touches only, so scripted approvals do not increment it and do not set `assisted`. This
  reconciles the card's AC #2 with the benchmark spec, and lands as decision **D13** in
  `notes/00-discovery-log.md` §7. The time between seeing `waiting` and sending the signal is
  the stage's `waiting_ms`; pause time is excluded from `active_ms`.
- **R5** Adapter contract extension (generic, not G-specific): an adapter may yield
  `{ type: 'intervention', stage, at, kind, note }` events alongside stage events. The core
  writes them with `store.insertIntervention` and does not count them as stage records.
  The stub adapter and existing tests are unchanged.
- **R6 (AC #1)** Telemetry normalisation. After the workflow ends or is cancelled, the
  adapter reads `graph/.run-state/telemetry.jsonl`, keeps the lines whose `run_id` matches,
  and maps them to one `StageEvent` per stage:
  - Graph's per-stage record supplies timings, `model_requested`/`model_served`, `llm_calls`,
    `tool_calls`, tokens (all four kinds, plus `source`), `cost_usd`, `status`,
    `output`, `failure_label`/`failure_note`, and `telemetry_gaps`. Graph's gate-outcome
    record for the same stage supplies the record's `gate` (`{ name, decision }`); `expected`
    and `correct` stay unset, because scoring belongs to TASK-0014.
  - Design rounds (several design records) merge into one record. Tokens, calls, cost and
    wall/active ms are summed, `started_at` is taken from the first round and `ended_at` from
    the last, and `fix_attempts` = rounds − 1.
  - Graph fields the harness record has but graph does not measure are omitted (not zeroed),
    so the core's R3a names them as `defaulted:<field>` gaps.
  - A requested stage with no telemetry line because the run stopped earlier at a gate
    produces no record. The run's last record carries the stop (`status: 'stopped_by_gate'`
    or `'failed'`).
  - The graph result `stopped-invalid-output` (added by TASK-0022) maps to `status: 'failed'`,
    `failure_label: 'schema'` on that stage. The adapter must tolerate it being absent from
    an older graph.
- **R6a (amendment, 2026-11-05, orchestrator)** The harness record's `gate.expected` and
  `gate.correct` become optional in `bench/harness/src/record.ts`. Only scoring against the
  expected labels (TASK-0014) can fill them, and defaulting them would fabricate a grade,
  which spec 003 R3a forbids. Found in Phase 1: a G record carrying `gate: { name, decision }`
  failed validation. The `scores`/report code must treat an absent `correct` as "not scored",
  never as false.
- **R7** `version()` returns `graph@<graph/package.json version>+<git short sha of HEAD>`, or
  `+unknown` with a stderr warning when git is unavailable.
- **R8** Tests. Unit tests with no Temporal: the ticket parser; telemetry → `StageEvent`
  mapping from fixture JSONL (single round, three design rounds, a gate stop at triage, a
  cancelled run past `route`); the gate driver against a fake workflow handle (waiting →
  signal → intervention event, team `auto` → no signals); the stage-range validation; and the
  core writing intervention events. One opt-in end-to-end test (`npm run test:g`, skipped
  unless `BENCH_G_E2E=1`) runs `bench run --contender G` on T01 with stub reasoning and team
  `default` against a real Temporal. It asserts six stage records, one `scripted_approval`
  for design, and zero records with `interventions > 0`.
- **R9** No change under `graph/`. If one turns out to be required, stop and report it
  (runbook: such a change waits for TASK-0022 and rides this PR).

## Constraints

- Footprint: `bench/harness/src/adapters/g/` (new), `bench/harness/src/adapters/types.ts`,
  `bench/harness/src/adapters/registry.ts`, `bench/harness/src/core/run.ts` (R5 only), `bench/harness/src/record.ts` (R6a only),
  `bench/harness/tests/`, `bench/harness/package.json` + lockfile, `bench/harness/README.md`,
  `notes/00-discovery-log.md` (D13 row only).
- New dependency: `@temporalio/client` 1.25.0 exact (same as graph). Exact versions, lockfile,
  Node 22. The harness must not import from `graph/src/`: workflow type name and argument
  shape are restated in the adapter, which cites `graph/src/workflow/workflows.ts`.
- Benchmark integrity, verbatim from CLAUDE.md: "When working on `graph/` or any contender
  code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or
  `bench/*/reference.diff`." The adapter opens only `bench/tickets/<Tnn>/ticket.md`.

## Out of scope

Scoring against expected labels (TASK-0014), live model calls (C4; use stub reasoning), the
H5 fault-injection experiments, and a `--team` CLI flag in the core.
