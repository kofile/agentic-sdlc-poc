// npm run approve -- --run <id> --gate design --round 1 [--feedback "..."] [--by someone]
import { sendDecision } from './decision.ts';

sendDecision(process.argv, true).catch((e) => { console.error(e); process.exit(1); });
