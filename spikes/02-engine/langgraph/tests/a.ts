// TEST A: SIGKILL the (only) process mid-execute, then restart: resume via invoke(null)
import { freshData, run, kill9, waitFor, rid, verdict, sleep } from '../lib.ts';
freshData('a'); const S = await import('../../common/stubs.ts'); const { counts, ledger } = await import('./_h.ts'); let ok = true;
for (const v of [{ n: 'A1 kill mid-execute (before side effect)', knobs: { executeMs: 6000 }, killOn: 'execute:start', delay: 1500, guard: '0' },
                 { n: 'A2 kill after effect, before checkpoint (plain append)', knobs: { executeMs: 500, afterEffectMs: 6000 }, killOn: 'execute:effect-done', delay: 500, guard: '0' },
                 { n: 'A3 same as A2 but idempotency-guarded effect', knobs: { executeMs: 500, afterEffectMs: 6000 }, killOn: 'execute:effect-done', delay: 500, guard: '1' }]) {
  const id = rid('A'); const first = run(['start', id, 'auto-design', JSON.stringify(v.knobs)], { GUARD: v.guard });
  await waitFor(() => S.countCalls(id, v.killOn) >= 1); await sleep(v.delay); await kill9(first.p);
  const st = await run(['state', id]).done; console.log(`  -- SIGKILL; counts at kill: ${JSON.stringify(counts(id))}\n  -- state on disk: next=${JSON.stringify(st.res.next)} status=${st.res.values.status}`);
  // NOTHING resumes it by itself: an external caller must re-invoke
  await sleep(2000); const t0 = Date.now(); const r = await run(['continue', id], { GUARD: v.guard }).done; const after = counts(id); const L = ledger(id);
  const pass = r.res?.values.status === 'merged' && after.triage === 1 && after.route === 1 && after.design === 1 && after.plan === 1 && after['open-pr'] === 1;
  ok = verdict(`${v.n}: run resumed + completed, completed steps not redone`, pass, { result: r.res?.values.status, resumeMs: Date.now() - t0, counts: after, ledger: L, duplicateSideEffectInLedger: L.filter((x) => x.startsWith('execute:write-file')).length > 1 }) && ok;
}
process.exit(ok ? 0 : 1);
