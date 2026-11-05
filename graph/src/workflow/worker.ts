import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities.ts';
import { fileURLToPath } from 'node:url';

const address = process.env.TEMPORAL_ADDRESS ?? '127.0.0.1:7233';
const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? 'sdlc-graph-poc';

const conn = await NativeConnection.connect({ address });
const w = await Worker.create({
  connection: conn,
  namespace: 'default',
  taskQueue,
  workflowsPath: fileURLToPath(new URL('./workflows.ts', import.meta.url)),
  activities,
  shutdownForceTime: '2s',
});
console.log(`[worker] up pid=${process.pid} taskQueue=${taskQueue} address=${address}`);
await w.run();
