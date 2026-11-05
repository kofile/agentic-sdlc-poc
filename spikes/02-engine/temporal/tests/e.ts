// TEST E: gate policy as data
import { freshData, startWorker, kill9, client, rid, verdict, sleep } from '../lib.ts';
import { writeFileSync, rmSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
freshData('e'); const { until, dec, ledger } = await import('./_h.ts');
const c = await client(); const w = await startWorker(); let ok = true;
const run = async (team: string) => { const id = rid('E'); const h = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id, args: [{ runId: id, ticket: { id: 'T' }, team, knobs: { executeMs: 200 } }] }); return { id, h }; };
const a = await run('auto-design'); const ra = await a.h.result();
ok = verdict('E1 team auto-design: no human pause, completes unattended', ra.status === 'merged' && !ra.log.includes('gate:design:approved'), { log: ra.log }) && ok;
const b = await run('default'); const sb = await until(c, b.id, (s) => s.waiting?.gate === 'design');
ok = verdict('E2 team default: pauses at design gate', sb.waiting.gate === 'design', { waiting: sb.waiting }) && ok;
// flip policy file while b is paused
const f = fileURLToPath(new URL('../../teams/default.json', import.meta.url)); const orig = (await import('node:fs')).readFileSync(f, 'utf8');
writeFileSync(f, JSON.stringify({ team: 'default', gates: { design: 'auto', plan: 'auto', merge: 'auto' }, humanTimeoutSec: 3600 }));
const b2 = await run('default'); const rb2 = await b2.h.result();
const sbStill = await c.workflow.getHandle(b.id).query('state');
writeFileSync(f, orig);
ok = verdict('E3 config flipped to design:auto: NEW run skips the gate; in-flight run keeps its recorded snapshot (still paused)', rb2.status === 'merged' && sbStill.waiting?.gate === 'design', { newRun: rb2.log, inFlightRunStillWaiting: sbStill.waiting }) && ok;
await b.h.signal('decide', dec('design', 1, true)); await b.h.result();
await kill9(w); process.exit(ok ? 0 : 1);
