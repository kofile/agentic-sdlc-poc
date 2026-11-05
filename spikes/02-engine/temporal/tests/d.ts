// TEST D: reject-and-redo loop
import { freshData, startWorker, kill9, client, rid, verdict } from '../lib.ts';
freshData('d'); const { counts, until, dec, dumpHistory } = await import('./_h.ts'); const S = await import('../../common/stubs.ts');
const c = await client(); const w = await startWorker(); const id = rid('D');
const h = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id, args: [{ runId: id, ticket: { id: 'T-1' }, team: 'default', knobs: { executeMs: 300 } }] });
await until(c, id, (s) => s.waiting?.gate === 'design' && s.waiting.round === 1);
await h.signal('decide', dec('design', 1, false, 'use postgres not sqlite'));
await until(c, id, (s) => s.waiting?.gate === 'design' && s.waiting.round === 2);
await h.signal('decide', dec('design', 2, true));
const res = await h.result();
const dcalls = S.readJsonl('calls.jsonl').filter((x) => x.step === 'design').map((x) => ({ round: x.round, feedback: x.feedback }));
const hist = await dumpHistory(c, id);
const pass = res.status === 'merged' && res.designRounds === 2 && dcalls[1]?.feedback === 'use postgres not sqlite';
verdict('D reject with feedback -> design reruns with feedback -> approve', pass, { result: res.status, designCalls: dcalls, log: res.log });
console.log('  history (events):\n' + hist.join('\n'));
await kill9(w); process.exit(pass ? 0 : 1);
