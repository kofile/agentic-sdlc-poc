// TEST F: observability after a killed run and a failed run
import { freshData, startWorker, kill9, client, rid, verdict, sleep, waitFor } from '../lib.ts';
freshData('f'); const S = await import('../../common/stubs.ts'); const { dumpHistory } = await import('./_h.ts');
const c = await client(); let w = await startWorker(); let ok = true;
// killed run (worker stays dead)
const k = rid('F-killed');
const hk = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: k, args: [{ runId: k, ticket: { id: 'T' }, team: 'auto-design', knobs: { executeMs: 20000 } }] });
await waitFor(() => S.countCalls(k, 'execute:start') >= 1); await sleep(1000); await kill9(w); await sleep(5000);
const d = await hk.describe(); const raw: any = await c.workflowService.describeWorkflowExecution({ namespace: 'default', execution: { workflowId: k } });
const pa = raw.pendingActivities?.map((p: any) => ({ activity: p.activityType?.name, state: String(p.state), attempt: p.attempt, lastHeartbeat: p.lastHeartbeatTime ? 'yes' : 'no', lastFailure: p.lastFailure?.message })) ;
console.log('  -- KILLED RUN: describe() with worker dead\n', JSON.stringify({ status: d.status.name, pendingActivities: pa, queryable: await hk.query('state').then(() => true, (e) => `no: ${e.message.slice(0, 60)}`) }, null, 1));
console.log('  history (killed run, worker still dead):\n' + (await dumpHistory(c, k)).join('\n'));
ok = verdict('F1 killed run is inspectable w/o debugger (status, pending activity, event history)', !!pa?.length, 'see above');
// failed run: design always fails -> retries exhausted -> workflow fails
w = await startWorker(); const f = rid('F-failed');
const hf = await c.workflow.start('pipeline', { taskQueue: 'spike02', workflowId: f, args: [{ runId: f, ticket: { id: 'T' }, team: 'auto-design', knobs: { failDesignFirstN: 99, designMs: 50 } }] });
let err = ''; try { await hf.result(); } catch (e: any) { err = `${e.constructor.name} <- ${e.cause?.constructor?.name} <- ${e.cause?.cause?.message}`; }
console.log(`  -- FAILED RUN error: ${err}`);
const hist = await dumpHistory(c, f); console.log('  history (failed run):\n' + hist.join('\n'));
ok = verdict('F2 failed run: failure cause + terminal attempt in history (earlier attempts are NOT separate events)', hist.some((l) => l.includes('WORKFLOW_EXECUTION_FAILED')) && err.includes('529'), `error chain: ${err}`) && ok;
await kill9(w); process.exit(ok ? 0 : 1);
