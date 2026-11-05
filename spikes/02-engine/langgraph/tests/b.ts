// TEST B: duplicate / concurrent resume
import { freshData, run, rid, verdict, sleep } from '../lib.ts';
freshData('b'); const { counts, ledger } = await import('./_h.ts'); let ok = true;
// B1 sequential duplicate (second arrives after run finished)
{ const id = rid('B1'); await run(['start', id, 'default', '{"executeMs":300}']).done;
  const r1 = await run(['resume', id, 'approve']).done; const r2 = await run(['resume', id, 'approve']).done; const L = ledger(id);
  ok = verdict('B1 sequential duplicate resume after completion: harmless?', L.filter((x) => x.startsWith('execute')).length === 1, { first: r1.res?.values.status, secondOutput: (r2.res ? JSON.stringify(r2.res) : r2.out).slice(0, 300), ledger: L }) && ok; }
// B2 sequential duplicate that lands on the NEXT gate (strict team = design+plan+merge are human)
{ const id = rid('B2'); await run(['start', id, 'strict', '{"executeMs":300}']).done;
  const r1 = await run(['resume', id, 'approve']).done; const r2 = await run(['resume', id, 'approve']).done; // "duplicate" design approval
  ok = verdict('B2 duplicate design-approval on a strict team: duplicate must not be consumed as the PLAN approval', r2.res?.interrupts?.[0]?.gate === 'plan' /* duplicate must NOT advance the plan gate */, { afterFirst: { interrupts: r1.res?.interrupts }, afterSecond: { interrupts: r2.res?.interrupts, log: r2.res?.values.log }, ledger: ledger(id) }) && ok; }
// B2b same, but caller-side expected-gate check (check-then-act at the API layer)
{ const id = rid('B2b'); await run(['start', id, 'strict', '{"executeMs":300}']).done;
  await run(['resume', id, 'approve'], { EXPECT_GATE: 'design' }).done; const r2 = await run(['resume', id, 'approve'], { EXPECT_GATE: 'design' }).done;
  ok = verdict('B2b with a caller-side expected-gate check: stale duplicate ignored (sequential only)', r2.out.includes('STALE ignored') && r2.res?.interrupts[0]?.gate === 'plan', { out: r2.out.trim().slice(0, 300) }) && ok; }
// B3 concurrent, separate processes (4 at once)
{ const id = rid('B3'); await run(['start', id, 'default', '{"executeMs":1500}']).done;
  const rs = await Promise.all([1, 2, 3, 4].map(() => run(['resume', id, 'approve']).done)); const L = ledger(id); const c = counts(id);
  const dup = L.filter((x) => x.startsWith('execute:write-file')).length > 1 || L.filter((x) => x.startsWith('open-pr')).length > 1;
  ok = verdict('B3 4 concurrent resume PROCESSES on one thread: single execution?', !dup, { outputs: rs.map((r) => (r.res ? r.res.values.status : r.out.slice(0, 120))), counts: c, ledger: L }) && ok; }
// B4 concurrent, same process (shared compiled graph)
{ const id = rid('B4'); await run(['start', id, 'default', '{"executeMs":1500}']).done;
  const { build, Command } = await import('../graph.ts'); const g = build(); const cfg = { configurable: { thread_id: id } };
  const rs = await Promise.allSettled([1, 2].map(() => g.invoke(new Command({ resume: { approved: true } }), cfg)));
  const L = ledger(id); const dup = L.filter((x) => x.startsWith('execute:write-file')).length > 1;
  ok = verdict('B4 2 concurrent resumes in one process: single execution?', !dup, { settled: rs.map((r) => r.status + (r.status === 'rejected' ? ': ' + String((r as any).reason).slice(0, 100) : '')), ledger: L, counts: counts(id) }) && ok; }
process.exit(0);
