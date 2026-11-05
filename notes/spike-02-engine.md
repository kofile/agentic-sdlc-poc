# Spike 02: durable-graph engine behaviour (Temporal TS vs LangGraph JS)

Evidence input only. No recommendation. Code: `spikes/02-engine/` (`temporal/`, `langgraph/`, shared `common/stubs.ts`, gate-policy data `teams/*.json`, raw outputs `results/*.txt`). Nothing committed or pushed. Docker container removed, no stray processes.

## Versions (all pinned exact in package.json)
- Temporal: `@temporalio/{client,worker,workflow,activity}` 1.25.0; server image `temporalio/temporal:latest` = Temporal CLI 1.10.0, Server 1.32.2, UI 2.56.1 (dev server, SQLite inside the container, ports bound to 127.0.0.1).
- LangGraph: `@langchain/langgraph` 1.7.0, `@langchain/langgraph-checkpoint-sqlite` 1.1.0 (better-sqlite3 12.11.1), `@langchain/core` 1.3.4. A Postgres checkpointer package also exists (`@langchain/langgraph-checkpoint-postgres` 1.1.2); not tested.
- Node 22.23.2, tsx 4.23.15. Both run TS directly via `node --import tsx`.

## The toy pipeline (same in both)
triage stub -> CODE gate (A/B pass, else stop) -> route -> design -> approval gate -> plan -> approval gate -> execute (sleeps, writes file, ledger line) -> open-pr (ledger line) -> merge gate -> merge (ledger line). Gates: `design`, `plan`, `merge`, each `human|auto` from `teams/<team>.json` (`default`: design human; `strict`: all human; `auto-design`: all auto; `short-timeout`: design human with 4s timeout). Every stub call is logged to `calls.jsonl` (counts re-executions); real effects go to `ledger.jsonl` (run id + step + pid). Run with `npx tsx tests/<a-g>.ts` in each folder.

## Results

| Test | Temporal | LangGraph |
|---|---|---|
| A. SIGKILL mid-execute, restart | PASS (steps before execute ran once; execute retried) | PASS, but only because a caller re-invoked it (nothing auto-resumes) |
| A2. kill after effect, before ack | PARTIAL: effect duplicated in ledger (at-least-once); fixed by idempotency guard (A3 PASS) | PARTIAL: same duplicate; same guard fixes it |
| B. duplicate approval, sequential after completion | PASS (signal to closed workflow errors `WorkflowNotFoundError`) | PASS (silently a no-op) |
| B. duplicate approval that lands on the next human gate | PASS in my workflow because signals are keyed gate+round and stale ones dropped (my design choice, not engine default) | FAIL: duplicate "design approve" was consumed as the PLAN approval. PARTIAL with a caller-side expected-gate check (B2b) |
| B. concurrent approvals | PASS: 6 concurrent signals + 1 stale; 1 execution, 6 ignored | FAIL: 4 concurrent processes -> execute/open-pr ran 4 times; 2 concurrent in one process -> 2 times |
| C1. late approval after kill + restart (+ server restart for Temporal) | PASS | PASS |
| C2. timeout / escalation | PASS: durable timer fired while worker was dead; result seen on restart | PARTIAL: no timer primitive. Needed an external sweeper to resume with a timeout decision; nothing fires without it |
| D. reject-and-redo with feedback | PASS (a `for` loop) | PASS (conditional edge back to design node) |
| E. gate policy as data | PASS | PASS |
| F. observability | PARTIAL: strong for killed runs, intermediate failed attempts not events | PARTIAL: checkpoint history is good for state, weak for "why/what died" |
| G. ergonomics, retry, cache | PASS retry (G1), PASS replay no re-call (G2) | PASS retry (G1), PASS when gate is a separate node (G2), footgun reproduced in single-node variant (G3) |

Scoring note: "PASS" = behaviour met the stated expectation in my implementation, not "engine is better".

## Evidence

**A (Temporal)**, A1: worker SIGKILLed 1.5s into execute. Counts at kill: triage/route/design/plan = 1, execute:start = 1. After a new worker started: execute:start = 2, all earlier steps still 1, ledger `execute:write-file` x1, `open-pr` x1, result `merged`. Detection of the dead worker needed the activity `heartbeatTimeout` (3s, heartbeat every 0.5s); without heartbeats it would have waited for `startToCloseTimeout` (120s here). Total kill-to-result ~11s including my 2s deliberate downtime and ~1s worker boot/webpack bundle.
A2 (kill after the ledger write, before returning): ledger had `execute:write-file@pid29086` and `execute:write-file@pid29168`, i.e. duplicated. A3 with `once` guard: 1 line.

**A (LangGraph)**: process SIGKILLed; `getState` from a cold process shows `next:["execute"]`, status running. Nothing resumes it; a new process calling `invoke(null, {thread_id})` re-ran only `execute`. Counts identical to Temporal. A2 duplicated the ledger line identically; the guard fixed it. A node's result is checkpointed only after the node returns, so the node in flight is always re-run.

**B (Temporal)**: `ignoredDuplicates: 6`, one `execute:write-file`, one `open-pr`; signal after completion -> `WorkflowNotFoundError: workflow execution already completed`. Signals inside one workflow run on a single thread, so no race; the handler dropped anything not matching the current gate+round.

**B (LangGraph)**, B2, strict team: after first approve the interrupt is `plan`; a second identical `approve` advanced it to `merge` with log `gate:design:approved, gate:plan:approved`. B3: four resume processes at once gave outputs `merged, merged, running, running`, `execute:start` = 4, `open-pr` = 4, ledger with 4 `execute:write-file` and multiple `merge` (varies run to run). B4 (one process, `Promise.all` of two `invoke(Command({resume}))`): both fulfilled, 2 `execute:write-file`, 2 `open-pr`, 2 `merge`. SQLite checkpointer has no per-thread lock. A Postgres checkpointer plus an advisory lock or a per-thread queue in the API layer would likely close this; not tested.

**C (Temporal)**: paused at design gate, worker SIGKILLed, `docker restart` of the Temporal server, 8s wait, fresh worker; status RUNNING, query returned `waiting: design round 1`, approval completed the run, `design` called once. C2: 4s `condition()` timer expired with no worker; `describe()` showed RUNNING while the worker was down; on restart the run finished `escalated-timeout`.

**C (LangGraph)**: after an interrupt the process simply exits with code 0; the "pause" is a row in SQLite. 8s later a new process resumed it and it finished, `design` called once. For C2 the deadline sits in state; `state` after 6s still showed `next:["designWait"]`; only the `sweep` command (my script, intended for cron) resumed it with a timeout rejection. Not tested: whole-machine reboot (the SQLite file would survive, but I only killed processes) and any hosted LangGraph Platform/Server, which may offer scheduling.

**D history**: Temporal event history shows `TIMER_STARTED 1, WORKFLOW_EXECUTION_SIGNALED decide, TIMER_CANCELED 1, ACTIVITY_TASK_SCHEDULED design (round 2) ...` (full dump in `results/temporal-d.txt`). LangGraph checkpoint history shows `designWait(INTERRUPT) -> designReject -> design (round=2) -> designWait(INTERRUPT) -> plan ...` with `round=2` in state (`results/langgraph-d.txt`). Neither stores feedback in the history view by itself; I carried it in a variable/state field.

**E**: `auto-design` runs unattended in both; `default` pauses. Editing `teams/default.json` mid-flight: new runs follow the new file, the paused run keeps its snapshot (Temporal: policy loaded by an activity and recorded in history; LangGraph: policy copied into state at the first node). Whether snapshot-vs-live is wanted is a product decision; both engines make snapshot the easy path, and re-reading live needs an explicit extra read per gate (Temporal: another activity; LangGraph: read inside the node, which also re-runs on resume).

**F (Temporal)**, killed run, worker still dead: `describe()` -> `status RUNNING`, pending activity `execute`, `attempt: 2`, `lastFailure: "activity Heartbeat timeout"`, heartbeat present. Full event history is readable via API (`results/temporal-f.txt`; UI at :8233 shows the same, not screenshotted). `query` failed while no worker was up. Failed run (design stub fails every call, 5 attempts): `WorkflowFailedError <- ActivityFailure <- "stub model 529 overloaded (call #5)"`; history shows only the last attempt (`ACTIVITY_TASK_STARTED attempt=5`, `ACTIVITY_TASK_FAILED`), earlier failures are not separate events (they exist in `pendingActivities.lastFailure` while retrying).
**F (LangGraph)**: cold-process `getState` on the killed run: `next:["execute"]`, plus checkpoint history, one row per super-step (`step=9 next=[execute]`). It says nothing about a process dying or which node was mid-flight beyond `next`. Failed run: retry messages go to the caller's logs/console only; the checkpoint records the final error on the task (`design(ERROR:stub model 529 overloaded (call #5))`) and `next:["design"]`. No UI included in the OSS library (LangSmith/Studio exist; not tried).

**G**: retry with backoff.
- Temporal: configuration on the activity proxy, `retry: {initialInterval:'1s', backoffCoefficient:2, maximumAttempts:5}`. Measured gaps between model calls: >=1s then >=2s, succeeded attempt 3 (G1).
- LangGraph: `addNode(name, fn, {retryPolicy:{maxAttempts:5, initialInterval:1000, backoffFactor:2, jitter:false}})`. Same measured gaps (G1).
- Cache so a replay does not re-call the model: Temporal: inherent; a completed activity's result is in history and worker restart + replay did not re-call (`design` count 1 in G2 and in every A/C run). LangGraph: inherent only across node boundaries (checkpointed node results are not redone, G2). Not inherent inside a node with `interrupt()` (G3 below). LangGraph also has a `cachePolicy` node option and `InMemoryCache`/`BaseCache` classes (found in the typings); I did not test it, and a persistent cache would need its own backend.

## Footguns I actually hit
LangGraph:
1. `interrupt()` re-executes its node from the start on resume. G3: model call and interrupt in one node -> `design` stub called 2 times. Fix: gate is its own node (what the main graph does). Also the gate deadline had to be computed in a separate `arm` node, otherwise `Date.now()+timeout` would be recomputed on every resume.
2. A state key cannot share a name with a node (`design` threw at build time; renamed state key to `designDoc`).
3. `Annotation({default})` takes a factory function; passing a value crashes at construction with a vague `initialValueFactory is not a function`.
4. Unreachable nodes throw at compile; a conditional edge to a node you only wire in some modes needs care.
5. Resume payload is untyped and positional: a duplicate/late approve is consumed by whichever interrupt is pending (B2).
6. No concurrency guard on a thread (B3/B4).
Temporal:
1. Workflow code runs in a sandboxed bundle: no file reads, no `Date.now()`/random without the SDK's replay-safe versions, no imports of node modules. I read the gate policy through an activity for this reason. I did not hit a non-determinism error in this spike, and did not test deploying a changed workflow against in-flight runs (versioning/patching), which is the known long-running-workflow burden.
2. Without activity heartbeats, a SIGKILLed worker looks alive until `startToCloseTimeout`.
3. A signal delivered to a workflow is always accepted into history even if you "ignore" it in code; I had to key by gate+round to avoid the stale-approval problem (same class as LangGraph B2, but fixable inside the workflow).
4. Queries need a live worker.
5. Worker bundling (webpack) adds ~1s to each worker start.

## Ergonomics numbers
- Lines (non-blank, incl. comments) for the pipeline: Temporal `workflows.ts` 75 + `activities.ts` 17 + `worker.ts` 12 = 104 (plus a client call). LangGraph `graph.ts` 69 + `runner.ts` 16 = 85. Shared stubs 72 not counted. Both are dense; line counts are not a strong signal.
- Concepts to learn: Temporal: workflow vs activity, task queue, worker, signal, query, `condition` + timer, retry policy, heartbeat, determinism/sandbox, workflow id (plus the server process). LangGraph: state + reducers (Annotation), nodes, edges and conditional edges, checkpointer, thread id, `interrupt`/`Command({resume})`, retryPolicy, `getState/getStateHistory`, plus the rule that nodes re-run. No server.
- Operational shape: Temporal needs a server (dev server in Docker here; production = self-host or Temporal Cloud) plus worker processes; resume after a crash is automatic. LangGraph is a library; you provide the process, the DB, the scheduler for timeouts, and whatever re-invokes interrupted runs.

## Build time (rough)
Temporal ~35 min of agent work including tests; LangGraph ~35 min. My Temporal TS knowledge was more current than LangGraph JS 1.x; LangGraph cost extra time on the three API gotchas above (they were quick to fix). Test scripts took longer than either implementation. Total about 1.5h of wall time.

## Where my results differ from, or go beyond, the docs
I did not read docs during the spike (no lookups made), so I cannot cite where a docs claim was contradicted. Observed behaviours worth checking against docs:
- Temporal's retry docs are consistent with observation, but history shows only the final failed attempt rather than one event per attempt.
- LangGraph's persistence docs describe "durable execution" and resume from the last checkpoint; observed true, but resume is entirely caller-driven, and concurrent resumes on one thread double-executed on the SQLite checkpointer.

## What I could not test or did not do
- Temporal workflow versioning/patching with in-flight runs; Temporal `Update` (validated, reply-returning approval) in place of Signals; Temporal Cloud; multi-worker concurrency; the web UI visually (API dump only).
- LangGraph Postgres checkpointer, LangGraph Platform/Server (task queue, cron, concurrency strategies), LangSmith/Studio, `cachePolicy`, subgraphs, `durability` modes (e.g. sync vs async checkpoint writes) which may change A2-style windows; machine reboot; large state sizes.
- Real LLM latency, tokens, streaming. Timing figures are with 200-300ms stubs.
- Both engines tested single-machine, SQLite-backed (Temporal's dev server uses SQLite internally; production persistence is different).
- Fairness: my Temporal approval handling includes gate+round keying that I did not apply to LangGraph's graph (I tested the equivalent fix only as a caller-side check, B2b). The LangGraph concurrency failure (B3/B4) has no equivalent mitigation tested.
