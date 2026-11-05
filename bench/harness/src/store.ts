// SQLite store (node:sqlite). Tables: runs, stage_runs, scores, interventions.
// Schema creation is idempotent. stage_runs only accepts records that pass the zod schema.
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { StageRunRecordSchema, type StageRunRecord } from './record.ts';

export interface RunRow {
  run_id: string;
  contender: string;
  contender_version: string;
  ticket_id: string;
  rep: number;
  set_name: string;
  stages: string; // comma-joined stage list
  seed_order: number;
  started_at: string;
  ended_at: string | null;
  status: string; // running | completed | failed
  artifact_dir: string | null;
}

export interface InterventionInput {
  run_id: string;
  stage?: string | null;
  at: string;
  kind: string;
  note?: string | null;
}

export interface InterventionRow {
  id: number;
  run_id: string;
  stage: string | null;
  at: string;
  kind: string;
  note: string | null;
}

export interface Store {
  insertRun(run: RunRow): void;
  finishRun(runId: string, status: string, endedAt: string): void;
  /** Validates with zod; throws the ZodError (nothing stored) when invalid. */
  insertStageRun(record: unknown): StageRunRecord;
  insertIntervention(i: InterventionInput): number;
  listRuns(): RunRow[];
  listStageRuns(filter?: { run_id?: string; contender?: string; ticket_id?: string; stage?: string }): StageRunRecord[];
  listInterventions(runId?: string): InterventionRow[];
  close(): void;
}

// Vite (vitest) strips the `node:` prefix from sqlite and fails to resolve a static import,
// so load the builtin at runtime.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  contender TEXT NOT NULL,
  contender_version TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  rep INTEGER NOT NULL,
  set_name TEXT NOT NULL,
  stages TEXT NOT NULL,
  seed_order INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  artifact_dir TEXT
);
CREATE TABLE IF NOT EXISTS stage_runs (
  run_id TEXT NOT NULL,
  contender TEXT NOT NULL,
  ticket_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  record_json TEXT NOT NULL,
  PRIMARY KEY (run_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_stage_runs_contender ON stage_runs (contender, ticket_id, stage);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  stage TEXT,
  kind TEXT NOT NULL,
  value REAL,
  detail_json TEXT
);
CREATE TABLE IF NOT EXISTS interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  stage TEXT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  note TEXT
);
`;

export function openStore(dbPath: string): Store {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db: DatabaseSyncType = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  const insRun = db.prepare(
    `INSERT INTO runs (run_id, contender, contender_version, ticket_id, rep, set_name, stages, seed_order, started_at, ended_at, status, artifact_dir)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const finRun = db.prepare(`UPDATE runs SET status = ?, ended_at = ? WHERE run_id = ?`);
  const insStage = db.prepare(
    `INSERT INTO stage_runs (run_id, contender, ticket_id, stage, status, record_json) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insInt = db.prepare(`INSERT INTO interventions (run_id, stage, at, kind, note) VALUES (?, ?, ?, ?, ?)`);

  return {
    insertRun(r) {
      insRun.run(r.run_id, r.contender, r.contender_version, r.ticket_id, r.rep, r.set_name, r.stages, r.seed_order, r.started_at, r.ended_at, r.status, r.artifact_dir);
    },
    finishRun(runId, status, endedAt) {
      finRun.run(status, endedAt, runId);
    },
    insertStageRun(record) {
      const rec = StageRunRecordSchema.parse(record);
      insStage.run(rec.run_id, rec.contender, rec.ticket_id, rec.stage, rec.status, JSON.stringify(rec));
      return rec;
    },
    insertIntervention(i) {
      const res = insInt.run(i.run_id, i.stage ?? null, i.at, i.kind, i.note ?? null);
      return Number(res.lastInsertRowid);
    },
    listRuns() {
      return db.prepare(`SELECT * FROM runs ORDER BY started_at, run_id`).all() as unknown as RunRow[];
    },
    listStageRuns(filter = {}) {
      const where: string[] = [];
      const args: string[] = [];
      for (const k of ['run_id', 'contender', 'ticket_id', 'stage'] as const) {
        const v = filter[k];
        if (v !== undefined) {
          where.push(`${k} = ?`);
          args.push(v);
        }
      }
      const sql = `SELECT record_json FROM stage_runs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY run_id, rowid`;
      const rows = db.prepare(sql).all(...args) as unknown as { record_json: string }[];
      return rows.map((r) => JSON.parse(r.record_json) as StageRunRecord);
    },
    listInterventions(runId) {
      const rows = runId
        ? db.prepare(`SELECT * FROM interventions WHERE run_id = ? ORDER BY id`).all(runId)
        : db.prepare(`SELECT * FROM interventions ORDER BY id`).all();
      return rows as unknown as InterventionRow[];
    },
    close() {
      db.close();
    },
  };
}
