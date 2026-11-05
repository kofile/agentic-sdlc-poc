// Process-level composition root (worker side only — never imported by workflows.ts, which
// runs in Temporal's deterministic sandbox). Wires ports to stub/in-memory adapters. Swapping
// a real adapter in later means changing only this file.
import { StubReasoning } from '../adapters/stub-reasoning.ts';
import { MemoryTracker } from '../adapters/memory-tracker.ts';
import { MemoryDocs } from '../adapters/memory-docs.ts';
import { MemoryVcs } from '../adapters/memory-vcs.ts';
import { FileConfig } from '../adapters/file-config.ts';
import { SystemClock } from '../adapters/system-clock.ts';
import { DockerExecuteHost } from '../adapters/docker-execute-host.ts';
import type { ExecuteHost } from '../ports/execute-host.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const GRAPH_ROOT = path.resolve(here, '../..');

export const reasoning = new StubReasoning();
export const tracker = new MemoryTracker();
export const docs = new MemoryDocs();
export const vcs = new MemoryVcs();
export const config = new FileConfig();
export const clock = new SystemClock();

export const EXECUTE_HOST_STATE_DIR = path.join(GRAPH_ROOT, '.run-state');
export const executeHost: ExecuteHost = new DockerExecuteHost({
  stateDir: EXECUTE_HOST_STATE_DIR,
  image: 'sdlc-graph-poc-execute-host:latest',
  ownerId: 'sdlc-graph-poc',
  hardKillGraceMs: 6000,
});

export const TELEMETRY_FILE = path.join(GRAPH_ROOT, '.run-state', 'telemetry.jsonl');
export const CONTENDER_VERSION = 'sdlc-graph-poc-walking-skeleton-0.1.0';
