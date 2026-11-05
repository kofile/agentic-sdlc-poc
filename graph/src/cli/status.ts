// npm run status -- --run <id>
import { makeClient } from '../workflow/client.ts';

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const runId = arg('run');
  if (!runId) { console.error('usage: npm run status -- --run <id>'); process.exit(1); }
  const client = await makeClient();
  const handle = client.workflow.getHandle(runId!);
  const desc = await handle.describe();
  console.log(`[status] run=${runId} temporalStatus=${desc.status.name}`);
  try {
    const state = await handle.query<any>('state');
    console.log('[status] query:', JSON.stringify(state, null, 2));
  } catch (e) {
    console.log('[status] query failed (workflow may have no live worker or already completed):', String(e));
  }
  if (desc.status.name === 'COMPLETED') {
    const result = await handle.result();
    console.log('[status] result:', JSON.stringify(result, null, 2));
  }
}

main();
