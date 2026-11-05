// Idempotent, HMAC-verifying completion receiver. Usage: node receiver.ts --port N --state DIR  (binds 127.0.0.1 only)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { verify } from './hmac.ts';

const arg = (k: string, d?: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const port = Number(arg('port', '0')); const state = arg('state')!; const maxSkew = Number(arg('skew', '300'));
fs.mkdirSync(path.join(state, 'completions'), { recursive: true });
const log = (o: object) => fs.appendFileSync(path.join(state, 'deliveries.ndjson'), JSON.stringify({ at: Date.now(), ...o }) + '\n');

const srv = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') { res.end('ok'); return; }
  if (req.method !== 'POST' || req.url !== '/callback') { res.writeHead(404).end(); return; }
  const chunks: Buffer[] = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > 65536) req.destroy(); else chunks.push(c); });
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const jobId = String(req.headers['x-job-id'] ?? ''); const ts = String(req.headers['x-timestamp'] ?? ''); const sig = String(req.headers['x-signature'] ?? '');
    const reply = (code: number, outcome: string, extra = {}) => { log({ jobId, outcome, ...extra }); res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify({ outcome })); };
    if (!/^j-[0-9a-f]{10}$/.test(jobId)) return reply(400, 'bad_job_id');
    let secret: string; try { secret = fs.readFileSync(path.join(state, 'jobs', jobId, 'secrets/callback_secret'), 'utf8'); } catch { return reply(404, 'unknown_job'); }
    if (!verify(secret, ts, body, sig)) return reply(401, 'bad_signature');
    if (Math.abs(Date.now() / 1000 - Number(ts)) > maxSkew) return reply(401, 'stale_timestamp');
    let ev: any; try { ev = JSON.parse(body); } catch { return reply(400, 'bad_json'); }
    if (ev.jobId !== jobId) return reply(400, 'job_id_mismatch');
    try { fs.writeFileSync(path.join(state, 'completions', jobId + '.json'), body, { flag: 'wx' }); } // first writer wins
    catch (e: any) { if (e.code === 'EEXIST') return reply(200, 'duplicate', { deliveryId: ev.deliveryId }); throw e; }
    reply(200, 'accepted', { deliveryId: ev.deliveryId, status: ev.status, source: ev.source });
  });
});
srv.listen(port, '127.0.0.1', () => console.log('receiver listening 127.0.0.1:' + (srv.address() as any).port));
