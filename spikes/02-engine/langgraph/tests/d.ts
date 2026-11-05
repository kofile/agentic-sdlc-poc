// TEST D: reject-and-redo loop
import { freshData, run, rid, verdict } from '../lib.ts';
freshData('d'); const S = await import('../../common/stubs.ts'); const id = rid('D');
await run(['start', id, 'default', '{"executeMs":300}']).done;
const r1 = await run(['resume', id, 'reject', 'use postgres not sqlite']).done;
const r2 = await run(['resume', id, 'approve']).done;
const calls = S.readJsonl('calls.jsonl').filter((x) => x.step === 'design').map((x) => ({ round: x.round, feedback: x.feedback }));
const h = await run(['history', id]).done;
const pass = r2.res?.values.status === 'merged' && calls[1]?.feedback === 'use postgres not sqlite' && r1.res.interrupts[0].round === 2;
verdict('D reject with feedback -> design reruns with feedback -> approve', pass, { afterReject: r1.res.interrupts, final: r2.res.values, designCalls: calls });
console.log('  checkpoint history (oldest first):\n' + h.out.replace('HISTORY\n', ''));
process.exit(pass ? 0 : 1);
