# Plan 004 — integration test worker leak

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md`, `notes/00-discovery-log.md` and the
runbook's per-PR gates.

## Approach

1. **Spawn the worker as a process-group leader.** In `startWorker()`, spawn with
   `detached: true` so the child gets its own process group, and pass
   `env: { ...process.env, TEMPORAL_TASK_QUEUE: RUN_QUEUE }`. Prefer spawning
   `process.execPath` with `['--import', 'tsx', 'src/workflow/worker.ts']` (same as the
   package's `worker` script) over `npx tsx`, removing the npm wrapper layer; the group
   kill below is still what guarantees the tree dies.
2. **Kill by group.** A `killTree(p)` helper sends `SIGKILL` to `-p.pid`
   (`process.kill(-pid, 'SIGKILL')`), tolerating `ESRCH`, and waits for the child's `exit`
   event (bounded, e.g. 5 s). Every existing `worker.kill('SIGKILL')` becomes `killTree`.
3. **Track and always clean up.** Keep a module-level `Set` of live worker children;
   `startWorker` adds, `killTree` removes. `main()` runs the tests in `try/finally`, and the
   `finally` kills everything still in the set before `process.exit`. Also register a
   synchronous `process.on('exit')` fallback and `SIGINT`/`SIGTERM` handlers that group-kill
   whatever remains (synchronous `process.kill`, no awaits).
4. **Per-run queue.** `const RUN_QUEUE = \`sdlc-graph-poc-it-${Date.now()}-${random}\``;
   replace the imported `TASK_QUEUE` in both `workflow.start/execute` calls with it; log it at
   startup.

## Verification (orchestrator re-runs)

- Kill any pre-existing stray `worker.ts` processes; confirm `temporal-dev` is up on
  127.0.0.1:7233.
- `npm run test:integration` twice in a row → `ALL PASS` each time; after each,
  `ps -axo pid,command | grep '[w]orker.ts'` prints nothing.
- Negative check: with a stray worker deliberately started on the default queue, the run
  still passes and its workflows never land on that worker.
- `npm run build && npm test && npm run test:workflow` green (unchanged code paths).
