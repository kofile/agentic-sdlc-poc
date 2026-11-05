import crypto from 'node:crypto';
export const sign = (secret: string, ts: string, body: string) => 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
export function verify(secret: string, ts: string, body: string, sig: string): boolean {
  const a = Buffer.from(sign(secret, ts, body)); const b = Buffer.from(sig || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
