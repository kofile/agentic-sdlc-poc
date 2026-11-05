// TEST B: duplicate + concurrent approvals
import { freshData, startWorker, kill9, client, rid, verdict } from '../lib.ts';
freshData('b'); const { counts, ledger, until, dec } = await import('./_h.ts');
const c = await client(); const w = await startWorker(); const id = rid('B');
const h = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id, args: [{ runId: id, ticket: { id: 'T-1' }, team: 'default', knobs: { executeMs: 500 } }] });
await until(c, id, (s) => s.waiting?.gate === 'design');
// 6 approvals fired concurrently + 1 stale approval for a different round
await Promise.all([...Array(6)].map(() => h.signal('decide', dec('design', 1, true))).concat(h.signal('decide', dec('design', 9, true))));
const res = await h.result();
const st = await h.query('state');
let late = 'no error'; try { await h.signal('decide', dec('design', 1, true)); } catch (e: any) { late = `${e.constructor.name}: ${e.message}`; }
const L = ledger(id);
const pass = res.status === 'merged' && L.filter((x) => x.startsWith('execute:write-file')).length === 1 && L.filter((x) => x.startsWith('open-pr')).length === 1;
verdict('B duplicate/concurrent approval: extra signals ignored, single execution', pass, { result: res.status, ignoredDuplicates: st.ignoredDuplicates, counts: counts(id), ledger: L, signalAfterCompletion: late });
await kill9(w); process.exit(pass ? 0 : 1);
