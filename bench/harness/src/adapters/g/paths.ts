// Repo-relative roots for the G adapter, resolved from this file's location
// (bench/harness/src/adapters/g/paths.ts -> repo root is five levels up).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(here, '..', '..', '..', '..', '..');
export const GRAPH_ROOT = path.join(REPO_ROOT, 'graph');
export const TICKETS_ROOT = path.join(REPO_ROOT, 'bench', 'tickets');
/** Where the graph worker appends its telemetry (graph/src/workflow/container.ts TELEMETRY_FILE, relative to graph/). */
export const GRAPH_TELEMETRY_FILE = path.join(GRAPH_ROOT, '.run-state', 'telemetry.jsonl');
