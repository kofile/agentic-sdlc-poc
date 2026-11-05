# Tasks 004 — integration test worker leak

## Phase 1: Process-tree kill and per-run queue

- [x] T001 `startWorker()` spawns `node --import tsx src/workflow/worker.ts` detached (own process group) with `TEMPORAL_TASK_QUEUE` set to the per-run queue
- [x] T002 `killTree()` group-kills with SIGKILL, tolerates ESRCH, awaits exit (bounded); replaces every `worker.kill`
- [x] T003 Live-worker set plus `try/finally` in `main()`, and `exit`/`SIGINT`/`SIGTERM` fallbacks, so every path kills every tree
- [x] T004 Per-run queue name used by every `workflow.start` / `workflow.execute`; logged at startup

## Phase 2: Verification

- [ ] T005 Two consecutive `npm run test:integration` runs → `ALL PASS`, and `ps` shows zero `worker.ts` processes after each
- [ ] T006 A stray worker on the default queue does not affect a run
- [ ] T007 `npm run build && npm test && npm run test:workflow` green
