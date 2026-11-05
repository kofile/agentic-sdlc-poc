// TEST G: retry w/ backoff; interrupt re-executes node (footgun); cached LLM result across resume
import { freshData, run, rid, verdict } from '../lib.ts';
freshData('g'); const S = await import('../../common/stubs.ts'); const { counts } = await import('./_h.ts'); let ok = true;
{ const id = rid('G1'); const r = await run(['start', id, 'auto-design', '{"failDesignFirstN":2,"designMs":50,"executeMs":100}']).done;
  const ts = S.readJsonl('calls.jsonl').filter((x) => x.runId === id && x.step === 'design').map((x) => x.t); const gaps = ts.slice(1).map((t, i) => t - ts[i]);
  ok = verdict('G1 retryPolicy (node option; initial 1s x2, no jitter) succeeds on 3rd attempt', r.res?.values.status === 'merged' && ts.length === 3 && gaps[0] >= 900 && gaps[1] >= 1900, { designCalls: ts.length, gapsMs: gaps }) && ok; }
{ const id = rid('G2'); await run(['start', id, 'default', '{"executeMs":100}']).done; await run(['resume', id, 'approve']).done;
  ok = verdict('G2 (separate gate node) model call result is checkpointed: resume does NOT re-call model', counts(id).design === 1, { counts: counts(id) }) && ok; }
{ const id = rid('G3'); await run(['start', id, 'default', '{"executeMs":100}'], { NAIVE: '1' }).done; await run(['resume', id, 'approve'], { NAIVE: '1' }).done;
  ok = verdict('G3 FOOTGUN: model call + interrupt() in ONE node => model re-called on resume (expect design=2)', counts(id).design === 2, { counts: counts(id), note: 'PASS here means the footgun reproduced' }) && ok; }
process.exit(0);
