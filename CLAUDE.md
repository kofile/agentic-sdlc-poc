# CLAUDE.md

Proof of concept for a hosted, mostly autonomous SDLC system (Jira ticket in, reviewable PR out), compared head to head against the `sdlc-pipeline-plugin` and the n8n implementation. Read `notes/00-discovery-log.md` (decisions D1-D9, constraints K1-K8) and `notes/02-benchmark-spec.md` before changing anything. `notes/HANDOFF.md` says where work stands.

## Layout

- `notes/` discovery log, research, benchmark spec, spike reports (source material for the presentation)
- `bench/` ground-truth app, tickets, hidden tests, reference diffs, verify scripts
- `graph/` the Temporal (TypeScript) system under test, "contender G"
- `spikes/` throwaway evidence behind decisions; not product code
- `prior-art/` pointers into the ai-coe-plugins repo (local tags; link, do not copy)

## Rules that always hold

- **Local-only.** No remote, no pushes, no PRs. Commit only when the operator asks.
- **Secrets.** The OAuth token lives in the macOS Keychain (service `claude-bench-oauth`). Never print it, paste it, write it to a file in this repo, or bake it into an image. Read it at launch with `security find-generic-password -a "$USER" -s claude-bench-oauth -w`, pass it by file mount.
- **Benchmark integrity.** When working on `graph/` or any contender code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or `bench/*/reference.diff`. Hidden tests carry the canary string `BENCH-CANARY-7f3a91c2`; if it appears in any transcript or contender output, flag a leak.
- **Graders.** Expected ticket outcomes are graded independently by the operator and Cesar. Claude drafts but is never a grader of record.
- **External systems.** Sandbox Jira, Confluence and GitHub only, once provisioned. No writes to production systems. No cloud resources without the operator's say-so and a cost note.
- **Decisions** go in the log's Decisions table with the three-way grade (AICOE maintenance, customer ease, adaptability) and the evidence file. A choice made only in chat did not happen.
- **Honesty.** Report where the new system does not win. Mark unverified claims UNVERIFIED. Agent-reported results are not facts until re-run.
- **Vocabulary.** Internal docs use industry terms (durable execution, interrupt, idempotency, ports and adapters). Demo and manager-facing material uses plain language; the log's section 8 has the glossary.
- **Parallel agents** get disjoint directories, no git writes, and a brief that names the files they own.
- **Spend.** The plugin baseline runs on the operator's subscription; N and G use dedicated API keys. Stay inside the spec's per-run caps.

## Conventions

- TypeScript for new code, Node 22, exact dependency versions, committed lockfile. Python only for analysis.
- Prefer MCP over CLIs for Atlassian; no `gh`/`az` dependency in product code beyond sign-in.
- Verify the served model from the response, never from config.
