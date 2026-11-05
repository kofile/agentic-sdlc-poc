// npm run reject -- --run <id> --gate design --round 1 --feedback "please add X" [--by someone]
import { sendDecision } from './decision.ts';

sendDecision(process.argv, false).catch((e) => { console.error(e); process.exit(1); });
