// npm run run -- --ticket <file.md> --team default [--run-id custom-id] [--budget-seconds 60]
import { makeClient, TASK_QUEUE } from '../workflow/client.ts';
import { parseTicketFile } from './parse-ticket.ts';
import crypto from 'node:crypto';

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const ticketPath = arg('ticket');
  const team = arg('team', 'default')!;
  if (!ticketPath) {
    console.error('usage: npm run run -- --ticket <file.md> --team <team>');
    process.exit(1);
  }
  const ticket = parseTicketFile(ticketPath);
  const runId = arg('run-id') ?? `run-${ticket.id}-${crypto.randomBytes(3).toString('hex')}`;
  const budgetSeconds = Number(arg('budget-seconds', '60'));

  const client = await makeClient();
  const handle = await client.workflow.start('pipeline', {
    taskQueue: TASK_QUEUE,
    workflowId: runId,
    args: [{ runId, ticket, team, budgetSeconds }],
  });
  console.log(`[run] started workflowId=${handle.workflowId} ticket=${ticket.id} team=${team}`);
  console.log(`[run] poll with: npm run status -- --run ${handle.workflowId}`);

  // Stream progress by polling the query until a terminal result arrives, printing step changes.
  let lastStep = '';
  const poll = setInterval(async () => {
    try {
      const state = await handle.query<any>('state');
      if (state.step !== lastStep) {
        lastStep = state.step;
        console.log(`[run] step=${state.step}${state.waiting ? ` waiting-on=${state.waiting.gate}#${state.waiting.round}` : ''}`);
      }
    } catch { /* workflow may have just finished; ignore query races */ }
  }, 1000);

  try {
    const result = await handle.result();
    clearInterval(poll);
    console.log('[run] finished:', JSON.stringify(result, null, 2));
  } catch (e) {
    clearInterval(poll);
    console.error('[run] workflow failed:', e);
    process.exit(1);
  }
}

main();
