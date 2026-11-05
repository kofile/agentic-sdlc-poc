import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities.ts';
import { fileURLToPath } from 'node:url';

const conn = await NativeConnection.connect({ address: '127.0.0.1:7233' });
const w = await Worker.create({
  connection: conn, namespace: 'default', taskQueue: 'spike02',
  workflowsPath: fileURLToPath(new URL('./workflows.ts', import.meta.url)), activities,
  shutdownForceTime: '1s',
});
console.log(`worker up pid=${process.pid}`);
await w.run();
