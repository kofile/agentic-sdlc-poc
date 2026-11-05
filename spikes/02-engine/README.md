# Spike 02: engine comparison (Temporal TS vs LangGraph JS)
Prereq: Node 22, Docker. Temporal: `docker run -d --name spike02-temporal -p 127.0.0.1:7233:7233 -p 127.0.0.1:8233:8233 temporalio/temporal:latest server start-dev --ip 0.0.0.0 --db-filename /tmp/t.db`
Then `cd temporal && npm i && npx tsx tests/a.ts` (a..g). LangGraph: `cd langgraph && npm i && npx tsx tests/a.ts` (no server needed).
Shared stubs/ledger: common/stubs.ts. Gate policy data: teams/*.json. Raw outputs: results/. Data dirs: data/ (gitignore).
