# Plan 003 — bench CLI skeleton

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md` (TypeScript, Node 22, exact versions,
committed lockfile), `notes/02-benchmark-spec.md` section 7, and runbook ruling C2
(location `bench/harness/`).

## Layout

```
bench/harness/
  package.json        "name": "bench-harness", "type": "module", "bin": {"bench": "src/cli.ts"}
                      scripts: build (tsc --noEmit), test (vitest run), bench (node --import tsx src/cli.ts)
  tsconfig.json       modelled on graph/tsconfig.json
  src/
    cli.ts            parseArgs → run | report | export
    record.ts         StageRunRecordSchema (zod), Stage, Contender enums, STAGE_ORDER, parseStageRange
    run-id.ts         makeRunId(date, contender, ticket, rep)
    store.ts          openStore(path) → { insertRun, finishRun, insertStageRun(validated), insertIntervention, listStageRuns, close }
    adapters/
      types.ts        ContenderAdapter { id; version(): Promise<string>; run(ctx): AsyncIterable<StageEvent> }
      registry.ts     id → adapter (only 'stub' registered)
      stub.ts         deterministic events per stage, writes artifacts/<run_id>/stub.txt
    core/run.ts       orchestrates one run: create run row → iterate adapter events → normalise → validate → store
    report.ts         SQL-only aggregation → md/json
    export.ts         SQL-only → JSONL (one record per line)
  tests/
    record.test.ts  store.test.ts  report.test.ts  cli.e2e.test.ts
```

## Key decisions (settled)

- **SQLite via `node:sqlite`** (no native build, no dependency). It prints an
  ExperimentalWarning on Node 22; suppress only that warning in `cli.ts`
  (`process.removeAllListeners('warning')` is too broad — filter by name) and note it.
- `StageEvent` is the adapter's raw output; `core/run.ts` fills harness-owned fields
  (`run_id`, `benchmark_version` = `v0.1`, `rep`, `set`, timestamps if absent) so adapters
  cannot drift on them. Contender-specific logic stays in adapters.
- `stage_runs.record_json` holds the whole validated record; indexed columns duplicate keys
  for queries. Report/export never parse anything except this table and `runs`.
- `stub` contender id is a schema addition, excluded from reports by default (spec R3).

## Testing

vitest, temp dirs via `fs.mkdtempSync(os.tmpdir())` for DB and artifacts. The e2e test spawns
`node --import tsx src/cli.ts run --contender stub --ticket T01 --rep 1 --stages triage..plan --seed-order 1`
with `BENCH_DB`/`BENCH_ARTIFACTS` set, then `report --format json` and asserts counts.
