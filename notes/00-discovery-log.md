# Hosted agentic SDLC system — discovery log

Running notes for the discussion that precedes a proof-of-concept built **outside** this
repository. Everything here is meant to survive the move and become presentation material.
Decisions are graded on the three-way trade-off the project already uses (C11):
**AICOE maintenance load / customer ease of adoption / adaptability.**

Status: DISCOVERY — nothing here is decided unless it sits in the Decisions table.

## 1. Why this exists

The plugin (`sdlc-pipeline-plugin`) is skills-driven, mostly non-deterministic, and depends on
the harness (Claude Code), its tools and the model. The goal is a hosted system that runs the
same pipelines and capabilities, kicked off by a Jira ticket or other event instead of a person.
The n8n version (`kofile/ai-n8n-sdlc`) has gone from many nodes to a few that run the plugin.

Operator's standing concern: the plugin does not map well onto an unattended system.
Operator's instinct (a hypothesis, not a decision): less LLM decision-making, more gates, a graph
architecture (LangGraph or similar), with hooks/plugins as a natural extension model — which the
ports-and-adapters work already foreshadows.

## 2. Prior art in this repo (read before re-deriving)

Local-only archives, reachable by git tag (never push, never PR):

| Archive | Where | What it holds |
|---|---|---|
| Research vault | tag `research/vault-v1`, `docs/research/` | Portable-Agent-Runtime (14+ notes: harness inventory, stage-runner analysis, durable orchestrators, managed agents, HITL channels, cost, n8n constraints) and Ports-and-Adapters-Plugins |
| VCS port explainers | tags `explainer/vcs-port-v1..v4` | rendered ports-and-adapters design |
| Design docs | `docs/design/` | adaptability design (2026-09-30), VCS port decisions (2026-10-02) |

Inherited constraints (from the research brief):
- C2 n8n parity: nothing may require what an n8n implementation cannot have (no filesystem in n8n Cloud).
- C4 harness-specific requirements live only in the core, never in adapters; core must be model-agnostic.
- C5 the LLM is never trusted for deterministic decisions.
- C9 MCP preferred where possible.
- Managed over self-hosted, up to a point.
- Atlassian (Jira + Confluence) stays mandatory.

What the archive already concluded (2026-10-07, "Stage Runner Architecture"): the hexagon's inside
is a **stateless per-stage runner** (CLI in a container) that owns contracts, gates, validation and
side-effects; each runtime's orchestrator (n8n, plugin) is a thin driving adapter; the LLM step is a
driven "reasoning" port. Build order is a strangler: triage/route, design/plan, validate/review/merge, execute last.

**The new question** is whether the graph should reach *inside* the stage, so determinism is
not just between stages but within them.

## 3. Working hypothesis: where the LLM actually has to decide

Draft classification of the stage ladder (operator to correct):

| Stage | Shape | Notes |
|---|---|---|
| triage | LLM as typed function | grade -> strict JSON; gate is code |
| repo-route | LLM as typed function | classify against catalog -> JSON; gate is code |
| design | LLM generation, single shot | pre-loaded context, schema'd sections; human gate candidate |
| plan | LLM generation, single shot | task schema; shard validation is code |
| qa-plan | LLM generation, single shot | no repo access by design |
| execute | **agentic loop** | read/edit/run tests; the hard case |
| open-pr | pure code | no LLM |
| validate | code gates + **agentic fixer** | gates run commands; fixer loop is bounded |
| pr-review | LLM as typed function + **agentic fixer** | findings are schema'd |
| merge | code gates + one typed judgment | plan-alignment verdict |
| deploy | code + **agentic root-cause fixer** | |

If this holds, roughly seven stages need no agent at all; the genuine agent nodes are
**execute and three fixers**. That is a much smaller problem than "make the whole plugin
deterministic": a commodity sandboxed coding agent behind one port, wrapped in budgets and
post-conditions, plus a graph around it.

## 4. Axes of the architecture (the discussion map)

1. Graph/durable-execution engine: state, retries, fan-out, pause/resume for human gates.
2. The LLM node contract: typed function, schema in/out, retry policy, eval-ability.
3. The agent node: sandbox + coding harness (build vs. wrap), budgets, post-conditions.
4. Ports and adapters: tracker, docs, VCS (already built), reasoning, sandbox, config.
5. Gate policy as data: per-team choice of human vs. automatic gates (operator: "configurable per team").
6. Hooks/extension points: before/after node, custom gate, custom adapter, custom stage.
7. Triggers, identity, credentials, tenancy.
8. Observability and evaluation: replayable runs, golden tests per LLM node.
9. Prompt assets: reuse of plugin skill/agent Markdown vs. prompts owned by the graph.

## 5. Operator answers so far (2026-11-04)

| Question | Answer |
|---|---|
| How far down does determinism go? | Not sure yet |
| Relation to the existing plugin | Undecided |
| Engine constraints | TypeScript preferred; Python is fine; managed over self-hosted |
| Human gates | Configurable per team (gate policy is data) |

### Round 2 answers (2026-11-04)

| Question | Answer |
|---|---|
| Does the section 3 table hold? | Largely yes. `design` and `plan` are one-shot; a review may loop (design -> human -> redesign) but nothing iterative in between. `execute` is the heavy LLM stage and needs more than a simple loop. |
| PoC slice | Must show the **whole pipeline, triage through execution and PR creation**, at minimum. A triage-to-plan slice will not convince. |
| PoC proof | **Apples-to-apples comparison** against the existing plugin (and the n8n implementation if it can run the same work), with real metrics: speed, accuracy, tokens, cost, and so on. |
| Audience | Joe (supervisor): must SEE it run and SEE numbers and charts; dislikes redesign; allergic to "overdesign" and to design-pattern vocabulary (the ports-and-adapters talk went badly). Cesar (n8n implementer): will follow Joe if the data supports it; do not abandon n8n without reason, do not keep it if something is better. |
| Scale / tenancy | End goal is company-wide. PoC must show the architecture *could* scale (one instance vs. per-team vs. multi-tenant is open), not demo it. Wants numbers, costs, at-scale estimates. Test projects can be doctored; one or two real company projects possible. |
| Cloud | Kofile has **AWS and Azure** enterprise agreements. |
| Pause/resume | Required, at least as a safety hatch or optional add-on. End goal is minimal human in the loop. |
| Execute node | Open to a full harness in a VM/container (Claude Code, OpenCode, etc.); open to alternatives that avoid writing our own harness. |

## 6. Constraints distilled from the operator (not yet architecture decisions)

| # | Constraint | Source |
|---|---|---|
| K1 | The PoC is an **experiment with a scoreboard**, not just a prototype. | Round 2 |
| K2 | End-to-end coverage: ticket in, reviewable PR out, including `execute`. | Round 2 |
| K3 | Same tickets, repos and model across contenders so the comparison is fair. | Round 2 |
| K4 | Two registers: **internal docs and notes use correct industry terminology**; demos and write-ups for Joe use plain language. See section 8. | Round 2-3 |
| K5 | Pause/resume is available (and configurable per team) even though the goal is minimal HITL. | Round 1-2 |
| K6 | Gate policy is data, configurable per team. | Round 1 |
| K7 | Architecture must plausibly scale company-wide; PoC need not demo tenancy. | Round 2 |
| K8 | Prefer not to write our own coding harness. | Round 2 |

## 7. Decisions

| # | Decision | Date | A: AICOE maint. | B: customer ease | C: adaptability | Status |
|---|---|---|---|---|---|---|
| D1 | Benchmark runs the plugin two ways: as shipped (headline) and pinned to Sonnet (anchors only); N and G pinned to Sonnet 5.5 | 2026-11-05 | Med: two P configs to run | High: honest cost story | High | Decided |
| D2 | n8n baseline: use execution history for triage-to-plan; live sandbox copies only if Cesar can do it in about a day | 2026-11-05 | High: avoids n8n rework | Med | Med | Decided |
| D3 | Second independent grader of expected ticket outcomes is Cesar (operator is first); Claude drafts but does not grade | 2026-11-05 | Med | High: Cesar owns fairness | Med | Decided |
| D4 | The plugin runs on the operator's subscription during the benchmark; its cost is labelled estimated and cannot be cross-checked against provider logs; N and G use dedicated API keys | 2026-11-05 | High: no extra key/cost | Med: P cost is weaker evidence | Med | Decided |
| D5 | Thresholds and verdict rules freeze at end of Day 5, after the dev pilot and before held-out runs, tagged `spec-frozen` | 2026-11-05 | Med | High: data-informed thresholds | Med | Decided |
| D6 | Days 1-2 run three parallel spikes (plugin headless, Temporal vs LangGraph, execute-host callback/cancel); engine and host chosen by end of Day 2 | 2026-11-05 | Med: extra work up front | High: evidence over reading | High | Decided |
| D7 | PoC engine is **Temporal (TypeScript)**. Evidence: spike 2 (`notes/spike-02-engine.md`, agent-reported, not independently re-run). Limits to state: LangGraph tested only on the SQLite checkpointer (no Postgres, no hosted platform, no cachePolicy); the spike author knew Temporal better; Temporal's duplicate-approval safety relied on our own keying. Follow-up: test workflow versioning with in-flight runs on Day 3 | 2026-11-05 | Med: determinism and versioning to learn; Temporal Cloud is managed | Med | High: durable timers, auto-resume, per-run history | Decided |
| D8 | Execute node runs in local Docker behind an `ExecuteHost` interface for the PoC; cloud host (Fargate / Container Apps / AgentCore) chosen after the demo once access is provisioned. Evidence: spike 3 (`notes/spike-03-execute-host.md`, agent-reported, stub agent only). Interface needs `attach`, `list`, `reapOrphans`; poll fallback is mandatory; file-mounted secrets | 2026-11-05 | High: no cloud cost or setup now | Med | High: host swappable | Decided |
| D9 | Plugin baseline P can be driven headless (spike 1, `notes/spike-01-plugin-headless.md`). Runs must isolate user-level plugins; pinned-Sonnet variant needs `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` and `--model sonnet`; a driver answers stop-and-ask turns; stage cost is derived from the event stream | 2026-11-05 | Med | n/a | n/a | Recorded as finding |
| D10 | Operator added git remote `origin` (`https://github.com/kofile/agentic-sdlc-poc`). The "local-only" rule in `CLAUDE.md` is replaced: `origin` is the only remote and is approved for writes (branches, pushes, PRs), but commits and pushes still happen only when the operator asks. For the External systems rule, GitHub means this `origin` and nothing else. Evidence: `git remote -v`, operator statements in session 2026-11-05 | 2026-11-05 | Med: backup and history on a remote; Backlog checks remote branches | Med: teammates can see the work | Med | Decided |
| D11 | Hidden tests, `expected.draft.yaml` and `reference.diff` files stay in git history on `origin` (pushed 2026-11-05 in `08b2672` and earlier commits). Accepted for now; revisit if repo visibility widens beyond the operator and Cesar, contender agents can clone it, or a canary leak appears. Rewriting history would need a force-push. Evidence: operator statement in session 2026-11-05 | 2026-11-05 | Med: history rewrite deferred | Med: possible integrity risk if exposure widens | Med | Decided, revisit on trigger |

Note 2026-11-05: D7's follow-up (workflow versioning with in-flight runs) is answered in `notes/spike-04-versioning.md` — a run parked at the design gate survived a worker swap to a changed definition guarded by `patched()`, and the unguarded change failed replay with a determinism error (single patch, local server, mocked activities; Worker Versioning and Temporal Cloud not tested).

## 8. Vocabulary and presentation rules

**Two registers (operator, round 3).** Internal documentation, this log and the repo use the
industry-standard terms where they apply (directed graph / state machine, durable execution,
checkpointing, human-in-the-loop interrupt, hexagonal architecture / ports and adapters,
sandbox, tool use, guardrail, eval harness, idempotency). The demo, slideshow and any "Joe"
write-up use plain language. Keep a glossary mapping the two so the translation is mechanical.

| Internal term | Plain-language version for Joe |
|---|---|
| Directed graph / workflow | A flowchart where each box is either a script or one AI question with a fixed answer format |
| Ports and adapters | Swappable connectors (name it only if needed) |
| Durable execution / checkpoint | The run can stop for days and pick up where it left off |
| Human-in-the-loop interrupt | A pause where a person approves, then it continues |
| Eval harness | The scoreboard |

Presentation rules (demo register only):
- Lead with a side-by-side run and a chart, not a diagram. Architecture comes after the result.
- Say what it does NOT do, and where it does not win. Honest numbers carry more weight.
- Show the n8n implementation fairly. If it is the right trigger/glue layer, say so.

## 9. Round 3 (2026-11-04)

Operator answers:
- **n8n baseline:** wants both variants (many-node and single-node) if feasible; unsure of their current status. n8n connector now attached.
- **Benchmark repos:** (a) `ai-coe-plugins` itself, with its Jira board; (b) **MRNexus** (a BLT repository) once access arrives, which also serves the team's onboarding focus; (c) a purpose-built project and repository with a repeatable scripted test flow as ground truth.
- **Timeline:** no meeting scheduled; works alongside other work; target **about 2 weeks to an actual demo**.
- **Notes location:** clean branch `explore/hosted-agentic-system` (this file). A brand-new local repository is acceptable if warranted.

Findings from the live n8n instance (read-only, 2026-11-04):
- Workflows visible through the connector: `WF2.1 Jira Ticket -> GitHub Repo Router` (active), `WF2.2 - Architecture Designer` (active), `WF3 - Plan` (active, updated 2026-10-28), `Ticket Grader Webhook` (inactive, tagged Old), plus a set of `[HARSH] ...` copies in a separate folder.
- No WF4-WF9 (execute, validate, review, merge, deploy) are visible through the connector. Cannot yet say whether they do not exist, are not exposed to the connector, or live elsewhere. **To confirm with Cesar.**
- The instance is in heavy use: WF3 alone has 705 recorded executions, and about 1,500 executions across the visible workflows since 2026-10-01. Recent WF2.1/2.2/3 runs all show status success, with durations from about 17 s (router) to about 3 min (plan, designer).
- Consequence: n8n execution history is a **free baseline** for speed and success rate on triage-to-plan, without running anything new. Token and cost data per execution still needs checking.

## 9b. Cesar's reply and the n8n workflows (2026-11-04)

Cesar (n8n implementer), paraphrased: n8n has workflows for **execute, validate and review**; **merge and deploy are missing**. Two workflows named:
- `PR Reviewer & Approver` (`kXm9WaYSXp7MGmol`, "used for validate and review a PR"): readable through the connector.
- The execute/implement workflow (`ad47NpL1Nf3VlZUM`): **not exposed to the MCP connector**; the workflow's MCP access must be enabled (settings link: https://neumo.app.n8n.cloud/workflow/ad47NpL1Nf3VlZUM?settings=true) before we can read its design or executions.

What `PR Reviewer & Approver` actually is (23 nodes, active, last edited 2026-10-30):
- Trigger: GitHub webhook, only when a specific reviewer is requested or a draft is marked ready.
- Intake is code: normalize PR, fetch prior review state (GraphQL), skip if the head commit was already reviewed, fetch files, build a line-numbered diff (skips lockfiles/binaries, 120k-char cap).
- One LLM node: n8n AI Agent on **Claude Sonnet 5.5** (adaptive thinking, effort medium), with one tool (`read_repo_file`), `maxIterations` 15, and a **manual JSON-schema output parser** (severity-rated findings, prior-finding status).
- **The verdict is made by a Code node, not the model**: any medium+ finding blocks; unknown severities count as medium; truncated or empty diffs are never approved (fail closed); unclosed prior findings stay open.
- Side effects are code: approve / request changes with inline comments, fallback to a plain comment, resolve fixed threads, supersede old summaries.
- Prompt hardening: PR content declared untrusted data; injection attempts must be reported as a high finding.

Why this matters for the architecture: the existing n8n review stage already follows the pattern under discussion (LLM as a typed function, deterministic gates in code). It is evidence for the hypothesis and a fair, strong n8n baseline, not a strawman. It also shows n8n's ceiling: the agent has no checkout, only an HTTP file-read tool, so n8n cannot run tests or edit code itself, which is where `execute` and `validate` need a sandbox.

Coverage matrix (what exists to compare, to be confirmed):

| Stage | Plugin | n8n | New system |
|---|---|---|---|
| triage | yes | yes (grader webhook is inactive/old; `[HARSH]` copies) | build |
| route | yes | yes (WF2.1, active) | build |
| design | yes | yes (WF2.2, active) | build |
| plan | yes | yes (WF3, active, 705 runs) | build |
| execute | yes | yes (workflow not readable yet) | build |
| validate | yes | partly (review workflow; gates unknown) | build |
| review | yes | yes (`PR Reviewer & Approver`) | build |
| merge / deploy | yes | **missing** | out of PoC scope unless time allows |

## 9c. Spec review round 1 (2026-11-05, sections 0-4)

Raised, not yet decided: H1 is under-powered (4 anchors at k=5; consider 6-8 anchors, cheap because triage-only runs cost little); plugin may not run unattended under `claude -p` (spike 1); schedule is aggressive (Day 1 is 2026-11-05; repo, tickets, hidden tests and seeded PRs need a few days before G exists); $2.50 mean per run is likely low, replace after the first pilot; dev set lacks cross-repo and reject tickets; H2 falsification clause mixes two conditions; no live-demo script yet; freeze the spec with a git tag before the first scored run. Sections 5-9 reviewed 2026-11-05: added per-model price table and re-verify requirement, H5 framed as a capability comparison with equal fault types, freeze moved to Day 5, spikes added to Days 1-2, operating model (agent lanes, operator reviews at Days 2/5/7) and spot-check blindness limitation recorded in the spec. Still undecided: raise anchor-ticket count for H1, add cross-repo and reject tickets to dev set, split the H2 clause, add live-demo script and an at-scale architecture note, test the design-redesign loop with a scripted reject.

## 10. Open questions

- Which benchmark tickets and repos? (Need known-good outcomes for accuracy scoring.)
- Which n8n workflows cover execute through merge, if any? Does execution data include token counts/cost?
- Engine choice (durable engine vs. in-process graph); see candidate list in the chat notes.
- Execute-node harness and sandbox host; AWS vs. Azure placement.
- Scale model: one instance vs. per team vs. multi-tenant; cost per ticket at N tickets/month.
- Presentation date and format (none scheduled; target demo in about 2 weeks).
- New repository now, or after the first code is written?
