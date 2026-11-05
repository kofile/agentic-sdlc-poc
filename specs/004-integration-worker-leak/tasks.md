# Tasks 004 — integration test worker leak

## Phase 1: Process-tree kill and per-run queue

- [x] T001 `startWorker()` spawns `node --import tsx src/workflow/worker.ts` detached (own process group) with `TEMPORAL_TASK_QUEUE` set to the per-run queue
- [x] T002 `killTree()` group-kills with SIGKILL, tolerates ESRCH, awaits exit (bounded); replaces every `worker.kill`
- [x] T003 Live-worker set plus `try/finally` in `main()`, and `exit`/`SIGINT`/`SIGTERM` fallbacks, so every path kills every tree
- [x] T004 Per-run queue name used by every `workflow.start` / `workflow.execute`; logged at startup

## Phase 2: Verification

- [x] T005 Two consecutive `npm run test:integration` runs → `ALL PASS`, and `ps` shows zero `worker.ts` processes after each
- [x] T006 A stray worker on the default queue does not affect a run
- [x] T007 `npm run build && npm test && npm run test:workflow` green

## Verification record (orchestrator, 2026-11-05)

- Two consecutive `npm run test:integration` runs: `ALL PASS` (4/4) each, queues
  `sdlc-graph-poc-it-…-cqezfb` and `…-qa2fyk`; `ps` showed 0 `worker.ts` processes after each.
- With a stray worker polling the default `sdlc-graph-poc` queue: `ALL PASS`; the stray
  logged no activity.
- SIGINT to the running test process mid-run: 0 `worker.ts` processes afterwards.
  Caveat: on this host `node` is a Volta shim, and a signal sent to the shim PID is not
  forwarded to the real node child, so neither the test nor its workers see it. A terminal
  Ctrl-C signals the whole foreground group and is unaffected; a script that `kill`s the
  shim PID would orphan the test (and, before this fix, its workers).
- `npm run build` ok, `npm test` 32 passed, `npm run test:workflow` 10 passed.
