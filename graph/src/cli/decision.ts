import { makeClient } from '../workflow/client.ts';

function arg(argv: string[], name: string, def?: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}

export async function sendDecision(argv: string[], approved: boolean): Promise<void> {
  const runId = arg(argv, 'run');
  const gate = arg(argv, 'gate');
  const round = Number(arg(argv, 'round', '1'));
  const feedback = arg(argv, 'feedback');
  const by = arg(argv, 'by', 'operator');
  if (!runId || !gate) {
    console.error('usage: npm run approve|reject -- --run <id> --gate <name> --round <n> [--feedback "..."] [--by <who>]');
    process.exit(1);
  }
  const client = await makeClient();
  const handle = client.workflow.getHandle(runId);
  await handle.signal('decide', { gate, round, approved, feedback, by });
  console.log(`[${approved ? 'approve' : 'reject'}] sent for run=${runId} gate=${gate}#${round} by=${by}`);
}
