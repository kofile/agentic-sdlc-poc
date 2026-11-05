# Handoff (2026-11-05, end of Day 1)

## What this is

A 2-week proof of concept, Day 1 = Thu 2026-11-05, to convince the operator's manager (needs to see it run and see numbers) and Cesar (n8n owner) that a graph-based, mostly deterministic architecture is a sound base for a hosted SDLC system. Method: run the same tickets through three contenders (P = plugin, N = n8n, G = new Temporal system) and compare speed, cost, success, and variance. Full design in `notes/02-benchmark-spec.md`.

## Decided (see the log's Decisions table)

- D1 plugin runs as shipped (headline) and pinned to Sonnet (anchors); N and G pinned to Sonnet 5.5
- D2 n8n baseline from execution history first; live sandbox copies only if cheap
- D3 second grader is Cesar
- D4 plugin runs on subscription; its cost is an estimate
- D5 thresholds freeze at end of Day 5, tag `spec-frozen`
- D6/D7 spikes done; engine is Temporal (TypeScript)
- D8 execute runs in local Docker behind an `ExecuteHost` interface; cloud host after the demo
- D9 the plugin can be driven headless (findings in `notes/spike-01-plugin-headless.md`)

## State at handoff

- Committed: log, research, benchmark spec, three spike reports, `.gitignore`.
- Uncommitted at time of writing (commit is the operator's call): this file, `CLAUDE.md`, `spikes/` (unreviewed throwaway code; `spikes/*/data/` is not yet gitignored), `bench/` (Lane A), `graph/` (Lane B).
- **Lane A (`bench/`), re-run by the orchestrator:** `bash bench/verify/verify.sh` gave 11/11 tickets clean, cold, exit 0 (about 2m15s). An earlier cold run gave 8/11. Root cause was the test harness: supertest's per-request ephemeral servers and lingering keep-alive sockets corrupted responses. Fix: `bench/orderdesk/tests/testRequest.ts` (light-my-request, in-process, no sockets), sequential `verify.mjs` that keeps failure logs in `bench/.tmp/verify-failures/`. The agent also reports 3 cold runs, 1 under CPU load, and 10x `npm test` per app, all clean (agent-reported, not re-run by me). Canary appears only in `hidden-tests/`, `verify.mjs` and `CLAUDE.md`; `hidden-tests/` is gitignored. Nobody has read the tickets, hidden tests or reference diffs for quality yet; graders have not graded.
- **Lane B (`graph/`):** `npm test` (21) and `npm run test:workflow` (10) re-run by the orchestrator, pass. 2026-11-05: `npm run test:integration` (Docker) re-run in worktree task-0021, exit 0, 4 PASS / 0 FAIL (kill-worker-and-resume; Docker execute host opened a PR). Image `sdlc-graph-poc-execute-host:latest` id `sha256:67201773770953d869e9c57180121632a3762851c014c01bb586678d7227a2f2`. The Temporal dev container (`temporal-dev`, README step 1) had to be started first; an earlier attempt failed with the server down. Model steps are stubs. `graph/config/prices.json` is UNVERIFIED placeholders. Docker image `sdlc-graph-poc-execute-host:latest` is left built.

## Next steps, in order

1. Operator review of Lane A and Lane B (read tickets and reference diffs; re-run `graph` Docker integration test); commit what passes (Day 2 checkpoint).
2. Operator and Cesar grade tickets independently from `bench/tickets/grading-sheet.md` (do not show anyone `expected.draft.yaml` first); reconcile.
3. Build the `bench` harness (TypeScript CLI, SQLite, uniform stage-run record, spec section 7) with adapters for P (headless `claude -p`, isolated from user plugins, stream parsing, scripted answer driver), N (history first, then webhook/API), G.
4. Real adapters for G: Reasoning (Claude Code headless or API), Tracker (Jira sandbox via MCP), Docs (Confluence sandbox), Vcs. First real adapter to build: Reasoning.
5. Day 3: Temporal workflow-versioning test with runs in flight (open caveat on D7). Verify the price table in `graph/config/prices.json` against vendor pages before any scored run.
6. Dev-set pilot (Days 4-5), then freeze and tag; held-out runs; charts; demo script; write-up.

## Open items for the operator

- Message to Cesar sent? (grader role, MCP access on execute workflow `ad47NpL1Nf3VlZUM`, sandbox copies, telemetry questions.)
- Sandbox Jira project and Confluence space (title prefix `[SDLC-TEST]`, label `sdlc_test`).
- Per-contender Anthropic API keys for N and G.
- MRNexus access (optional tier; dropped if absent by Day 6).
- Whether subscription tokens may be used for container-based benchmark automation (token already minted and stored in the Keychain; nothing uses it yet).
- Undecided review points: more anchor tickets for H1, cross-repo and reject tickets in the dev set, H2 clause split, live-demo script, at-scale architecture note, scripted design-reject test.

## Things a new session should know

- This repo was split out of `ai-coe-plugins` on 2026-11-04. Prior research lives there as local git tags (`research/vault-v1`, `explainer/vcs-port-v1..v4`); see `prior-art/README.md`. Those archives are never pushed.
- Project memory from the old session lives under the `ai-coe-plugins` project path and does not load here. The rules that matter are copied into `CLAUDE.md`.
- The operator's audience dislikes design-pattern vocabulary; lead demos with a live run and charts.
