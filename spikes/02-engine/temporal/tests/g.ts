// TEST G: retry with backoff + "LLM result not re-called on replay"
import { freshData, startWorker, kill9, client, rid, verdict, sleep } from '../lib.ts';
freshData('g'); const S = await import('../../common/stubs.ts'); const { counts, until, dec } = await import('./_h.ts');
const c = await client(); let w = await startWorker(); let ok = true;
const id = rid('G'); const h = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id, args: [{ runId: id, ticket: { id: 'T' }, team: 'auto-design', knobs: { failDesignFirstN: 2, designMs: 50, executeMs: 100 } }] });
const res = await h.result(); const ts = S.readJsonl('calls.jsonl').filter((x) => x.runId === id && x.step === 'design').map((x) => x.t);
const gaps = ts.slice(1).map((t, i) => t - ts[i]);
ok = verdict('G1 retry w/ exponential backoff (initial 1s, x2) succeeds on 3rd attempt', res.status === 'merged' && ts.length === 3 && gaps[0] >= 900 && gaps[1] >= 1900, { designCalls: ts.length, gapsMs: gaps }) && ok;
// replay: pause at human gate after design ran, kill worker, new worker must replay history without re-calling the model
const id2 = rid('G2'); const h2 = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id2, args: [{ runId: id2, ticket: { id: 'T' }, team: 'default', knobs: { executeMs: 100 } }] });
await until(c, id2, (s) => s.waiting?.gate === 'design'); await kill9(w); w = await startWorker();
await until(c, id2, (s) => s.waiting?.gate === 'design'); await h2.signal('decide', dec('design', 1, true)); await h2.result();
ok = verdict('G2 expensive model call result lives in history: replay on fresh worker does NOT re-call model', counts(id2).design === 1, { counts: counts(id2) }) && ok;
await kill9(w); process.exit(ok ? 0 : 1);
