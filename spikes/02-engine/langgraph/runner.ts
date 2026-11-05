// CLI so each engine "process" can be started/killed/restarted by tests.  usage: runner.ts <cmd> <runId> [...]
import { build, Command } from './graph.ts';
const [cmd, runId, a3, a4] = process.argv.slice(2);
const naive = process.env.NAIVE === '1';
const g = build({ naive }); const cfg = { configurable: { thread_id: runId } };
const snap = async () => { const s = await g.getState(cfg); return { next: s.next, interrupts: s.tasks.flatMap((t: any) => t.interrupts.map((i: any) => i.value)), values: { status: s.values.status, round: s.values.round, log: s.values.log } }; };
try {
  if (cmd === 'start') await g.invoke({ runId, ticket: JSON.parse(process.env.TICKET ?? '{"id":"T-1"}'), team: a3, knobs: JSON.parse(a4 ?? '{}'), guard: process.env.GUARD === '1' }, cfg);
  else if (cmd === 'resume' && process.env.EXPECT_GATE && (await snap()).interrupts[0]?.gate !== process.env.EXPECT_GATE) console.log('STALE ignored: no pending ' + process.env.EXPECT_GATE + ' gate');
  else if (cmd === 'resume') await g.invoke(new Command({ resume: { approved: a3 === 'approve', feedback: a4 } }), cfg);
  else if (cmd === 'timeout') await g.invoke(new Command({ resume: { approved: false, by: 'timer', feedback: 'timeout' } }), cfg);
  else if (cmd === 'sweep') { const s = await snap(); const dl = s.interrupts[0]?.deadline; if (dl && Date.now() > dl) await g.invoke(new Command({ resume: { approved: false, by: 'timer', feedback: 'timeout' } }), cfg); }
  else if (cmd === 'history') { const rows: string[] = []; for await (const h of g.getStateHistory(cfg)) rows.push(`step=${h.metadata?.step} source=${h.metadata?.source} next=[${h.next}] status=${h.values.status} round=${h.values.round} grade=${h.values.grade ?? '-'} tasks=${h.tasks.map((t: any) => t.name + (t.interrupts.length ? '(INTERRUPT)' : '') + (t.error ? '(ERROR:' + String(t.error?.message ?? t.error).slice(0, 50) + ')' : '')).join(',')}`); console.log('HISTORY\n' + rows.reverse().join('\n')); }
  else if (cmd === 'continue') await g.invoke(null, cfg);
  console.log('RESULT ' + JSON.stringify(await snap()));
} catch (e: any) { console.log('ERROR ' + e.constructor?.name + ': ' + String(e.message).slice(0, 300)); process.exitCode = 3; }
