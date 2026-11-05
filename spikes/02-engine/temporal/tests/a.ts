// TEST A: SIGKILL worker mid-execute, restart. A1 kill mid-work; A2 kill after effect but before ack (plain append, then guarded)
import { freshData, startWorker, kill9, client, waitFor, rid, verdict, sleep } from '../lib.ts';
freshData('a'); const S = await import('../../common/stubs.ts'); const { counts, ledger } = await import('./_h.ts');
const c = await client(); let ok = true;
for (const v of [{ n: 'A1 kill mid-execute (before side effect)', knobs: { executeMs: 6000 }, killOn: 'execute:start', delay: 1500, guard: false },
                 { n: 'A2 kill after effect, before ack (plain append)', knobs: { executeMs: 500, afterEffectMs: 6000 }, killOn: 'execute:effect-done', delay: 500, guard: false },
                 { n: 'A3 same as A2 but idempotency-guarded effect', knobs: { executeMs: 500, afterEffectMs: 6000 }, killOn: 'execute:effect-done', delay: 500, guard: true }]) {
  let w = await startWorker(); const id = rid('A');
  const h = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: id, args: [{ runId: id, ticket: { id: 'T-1' }, team: 'auto-design', knobs: v.knobs, guard: v.guard }] });
  await waitFor(() => S.countCalls(id, v.killOn) >= 1); await sleep(v.delay);
  const before = counts(id); const t0 = Date.now(); await kill9(w); console.log(`  -- SIGKILL worker pid ${w.pid}; counts at kill:`, JSON.stringify(before));
  await sleep(2000); w = await startWorker(); const res = await h.result(); const resumeMs = Date.now() - t0;
  const after = counts(id); const L = ledger(id);
  const dupEffect = L.filter((x) => x.startsWith('execute:write-file')).length > 1;
  const pass = res.status === 'merged' && after.triage === 1 && after.route === 1 && after.design === 1 && after.plan === 1 && after['open-pr'] === 1;
  ok = verdict(`${v.n}: run resumed + completed, completed steps not redone`, pass, { result: res.status, resumeMs, counts: after, ledger: L, duplicateSideEffectInLedger: dupEffect }) && ok;
  await kill9(w);
}
process.exit(ok ? 0 : 1);
