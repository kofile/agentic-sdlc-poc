// TEST C: late approval; timeout escalation (no timer primitive: external sweeper)
import { freshData, run, rid, verdict, sleep } from '../lib.ts';
freshData('c'); const { counts, ledger } = await import('./_h.ts'); let ok = true;
{ const id = rid('C'); const s = await run(['start', id, 'default', '{"executeMs":300}']).done;
  console.log(`  -- process exited by itself at the interrupt (code ${s.code}); nothing is running. waiting 8s ("two days")`); await sleep(8000);
  const st = await run(['state', id]).done; const r = await run(['resume', id, 'approve']).done;
  ok = verdict('C1 late approval after process exit + 8s: state intact, completes', r.res?.values.status === 'merged' && counts(id).design === 1, { pausedState: { next: st.res.next, interrupts: st.res.interrupts }, result: r.res?.values, counts: counts(id), ledger: ledger(id) }) && ok; }
{ const id = rid('C2'); await run(['start', id, 'short-timeout', '{"executeMs":300}']).done; await sleep(6000);
  const noSweep = (await run(['state', id]).done).res; const r = await run(['sweep', id]).done;
  ok = verdict('C2 timeout escalation: only fires when an EXTERNAL sweeper runs (no built-in timer)', r.res?.values.log.includes('gate:design:rejected(timeout)'), { stateWithoutSweeper: { next: noSweep.next, status: noSweep.values.status }, afterSweep: r.res }) && ok; }
process.exit(0);
