import { Connection, Client } from '@temporalio/client';

const address = process.env.TEMPORAL_ADDRESS ?? '127.0.0.1:7233';
export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE ?? 'sdlc-graph-poc';

export async function makeClient(): Promise<Client> {
  const connection = await Connection.connect({ address });
  return new Client({ connection, namespace: 'default' });
}
