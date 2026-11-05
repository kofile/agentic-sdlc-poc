// TEST C: late approval across worker death + server restart; timer timeout/escalation
import { freshData, startWorker, kill9, client, rid, verdict, sleep } from '../lib.ts';
import { execSync } from 'node:child_process';
freshData('c'); const { counts, ledger, until, dec } = await import('./_h.ts');
let c = await client(); let ok = true;
// C1
let w = await startWorker(); const id = rid('C');
const h = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id, args: [{ runId: id, ticket: { id: 'T-1' }, team: 'default', knobs: { executeMs: 500 } }] });
await until(c, id, (s) => s.waiting?.gate === 'design');
await kill9(w); console.log('  -- worker SIGKILLed while paused at design gate');
execSync('docker restart spike02-temporal', { stdio: 'ignore' }); console.log('  -- temporal server container restarted'); 
await sleep(8000); console.log('  -- 8s "two days" elapsed; starting fresh worker');
c = await client(); w = await startWorker();
const d1 = await c.workflow.getHandle(id).describe(); const st = await until(c, id, (s) => s.waiting?.gate === 'design', 20000);
await c.workflow.getHandle(id).signal('decide', dec('design', 1, true));
const res = await c.workflow.getHandle(id).result();
ok = verdict('C1 late approval after worker kill + server restart + 8s: state intact, run completes', res.status === 'merged' && counts(id).design === 1, { statusBeforeApprove: d1.status.name, waiting: st.waiting, result: res.status, counts: counts(id), ledger: ledger(id) }) && ok;
await kill9(w);
// C2 timeout while worker is dead
const id2 = rid('C2'); w = await startWorker();
const h2 = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id2, args: [{ runId: id2, ticket: { id: 'T-2' }, team: 'short-timeout', knobs: { executeMs: 500 } }] });
await until(c, id2, (s) => s.waiting?.gate === 'design'); await kill9(w); console.log('  -- worker dead; 4s durable timer fires with nobody home'); await sleep(7000);
const dsc = await h2.describe(); console.log(`  -- status while worker still dead: ${dsc.status.name}`);
w = await startWorker(); const r2 = await h2.result();
ok = verdict('C2 durable timer timeout -> escalation fires even if worker was down when it expired', r2.status === 'escalated-timeout', { result: r2, log: r2.log, statusWhileWorkerDown: dsc.status.name }) && ok;
await kill9(w); process.exit(ok ? 0 : 1);
