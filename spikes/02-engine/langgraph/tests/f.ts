// TEST F: observability after killed + failed runs
import { freshData, run, kill9, rid, verdict, sleep, waitFor } from '../lib.ts';
freshData('f'); const S = await import('../../common/stubs.ts'); let ok = true;
const k = rid('F-killed'); const p = run(['start', k, 'auto-design', '{"executeMs":20000}']);
await waitFor(() => S.countCalls(k, 'execute:start') >= 1); await sleep(1000); await kill9(p.p); await sleep(1000);
const st = await run(['state', k]).done; const h = await run(['history', k]).done;
console.log('  -- KILLED RUN: getState() from a cold process\n ' + JSON.stringify(st.res, null, 1)); console.log('  checkpoint history:\n' + h.out.replace('HISTORY\n', ''));
console.log('  -- (note: nothing says WHICH node was running or that a process died; "next" just lists the node that will (re)run)');
ok = verdict('F1 killed run: inspect w/o debugger', st.res.next.includes('execute'), 'see above');
const f = rid('F-failed'); const rf = await run(['start', f, 'auto-design', '{"failDesignFirstN":99,"designMs":50}']).done;
const sf = await run(['state', f]).done; const hf = await run(['history', f]).done;
console.log(`  -- FAILED RUN: invoke() output: ${rf.out.trim().slice(0, 200)}\n  state: ${JSON.stringify(sf.res)}\n  checkpoint history:\n${hf.out.replace('HISTORY\n', '')}`);
ok = verdict('F2 failed run: cause + attempts visible?', rf.out.includes('529'), `error surfaced to caller only: ${rf.out.trim().slice(0, 120)}; designAttempts=${S.countCalls(f, 'design')}`) && ok;
process.exit(0);
