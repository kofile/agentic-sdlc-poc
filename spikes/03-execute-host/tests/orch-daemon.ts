// A throwaway "orchestrator" process used by test F: starts jobs, persists a registry, then idles until SIGKILLed.
import fs from 'node:fs';
import path from 'node:path';
import { mkHost, mkSpec } from './lib.ts';
const [stateDir, bare, port] = process.argv.slice(2);
const host = mkHost(stateDir);
const cb = { url: `http://host.docker.internal:${port}/callback` };
const A = await host.start(mkSpec(bare, { key: 'F-long', callback: cb, stub: { steps: 20, stepMs: 500 } }));          // ~10s
const B = await host.start(mkSpec(bare, { key: 'F-short', callback: cb, stub: { steps: 3, stepMs: 300 } }));          // ~1.5s, finishes while we are dead
await host.start(mkSpec(bare, { key: 'F-orphan', callback: cb, stub: { steps: 40, stepMs: 500 } }));                  // started, but "crash before registry write"
fs.writeFileSync(path.join(stateDir, 'registry.json'), JSON.stringify({ known: [A.jobId, B.jobId] }));
console.log('daemon ready'); setInterval(() => {}, 1000);
