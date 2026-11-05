# Benchmark specification: plugin vs n8n vs graph system

Status: DRAFT v0.1 (2026-11-04). Internal register (K4): industry terms are used here. The
demo write-up for Joe translates "eval harness" to "the scoreboard", "golden set" to "the
fixed set of practice tickets", and so on, using the glossary in `00-discovery-log.md` section 8.
Items marked **[A]** are assumptions to confirm. Constraints K1-K3 and K8 govern this spec.

## 0. Contenders

| Id | Contender | Notes |
|---|---|---|
| P | `sdlc-pipeline-plugin`, run headless (`claude -p`, `--output-format stream-json`) | Whole ladder in one orchestrated session via `run-pipeline`. |
| N | n8n workflows on the Neumo cloud instance (WF2.1, WF2.2, WF3, execute `ad47NpL1Nf3VlZUM`, `PR Reviewer & Approver` `kXm9WaYSXp7MGmol`) | Triage workflow is inactive/"Old" and the execute workflow is unreadable until MCP access is enabled. Both n8n variants (many-node, single-node) are run if both are runnable **[A]**. |
| G | New graph system (to be built) | Typed-function LLM nodes, code gates, one sandboxed coding-agent node for execute (K8: wrapped harness, not our own). |

## 1. Hypotheses (falsifiable, fixed before any scored run)

Each hypothesis is G vs the better of P and N, on stages both cover. "Run" = one ticket x one
contender x one repetition.

| Id | Hypothesis | Primary metric | Falsified if |
|---|---|---|---|
| H1 | Lower run-to-run variance | Coefficient of variation (CV) of cost and wall-clock per ticket, across k repeats | G median CV is not at least 25% lower than the best baseline |
| H2 | Lower cost per ticket | Mean USD per ticket (API list price equivalent) and USD per *successful* PR | G is not at least 20% cheaper on the pre-execute stages, or not cheaper end to end |
| H3 | Wall-clock similar or better | Median end-to-end active time per ticket | G median is more than 15% slower than the best baseline |
| H4 | Success rate similar or better | Hidden-tests-pass rate, plus PR-opened rate | G is more than 5 percentage points below the best baseline |
| H5 | Better resumability and observability | Fault-injection: % of killed runs that resume without redoing completed stages; % of failures with a root-cause label recoverable from the run record alone | G resumes in fewer cases than baselines, or needs a person to find the cause more often |
| H6 | Triage and route accuracy no worse | Gate-level accuracy vs expected labels (section 5.4) | G more than 5 points below best baseline |

H1 and H5 are the architecture's real claims. H4 and H6 are "do no harm" checks: the same
model sits behind all three, so a tie is the expected and acceptable outcome.

### Pre-registered verdicts

| Verdict | Definition for G |
|---|---|
| **Win** | Meets H1 and H2 thresholds, and H3, H4, H6 are not falsified |
| **Tie** | H3, H4, H6 not falsified, but H1 or H2 (not both) missed; or both within 10% of baseline. Reported as "equal results, with these other differences" |
| **Loss** | H4 or H6 falsified, or H1 and H2 both missed. A loss on one stage is reported per stage, never averaged away |

The verdict is computed per stage group (triage+route, design+plan, execute+PR, review) and
overall. Confidence: report medians with bootstrap 95% intervals; with k=3 to 5 treat
differences under about 10% as noise.

### Where G should NOT be expected to win (stated up front)

- **Execute success rate:** G wraps a commodity coding agent on the same model, so a tie is the
  prediction. A win here would be suspicious (check for test leakage).
- **Triage/route accuracy and design/plan quality:** same model, similar prompts. Tie expected.
- **Wall-clock on trivial tickets:** sandbox provisioning (cold start) may make G slower than P
  running in a warm local session. Likely loss.
- **n8n on review:** `PR Reviewer & Approver` already uses a typed output plus a code-made
  verdict. G is expected to tie it, not beat it.
- **Cost of execute:** token spend dominates and is set by the model and the agent loop. Savings
  are expected mostly from the other stages.
- **Maturity:** G is days old; P and N have months of use. Any G failure caused by an
  unfinished feature is labelled `immature` in the taxonomy and reported, not hidden.

## 2. Scope and coverage

Ladder: triage, repo-route, design, plan, (qa-plan, P only), execute, open-pr, validate,
pr-review, merge, deploy.

| Stage | P | N | G | In benchmark |
|---|---|---|---|---|
| triage | yes | workflow exists, inactive; `[HARSH]` copies. Reactivate a copy in the sandbox **[A]** | build | Core |
| repo-route | yes | WF2.1 active | build | Core |
| design | yes | WF2.2 active | build | Core |
| plan | yes | WF3 active | build | Core |
| qa-plan | yes | none | optional | Excluded (no peer) |
| execute | yes | exists, unreadable | build | Core (needs MCP access, section 9) |
| open-pr | yes | unknown (may be inside execute) | build | Core |
| validate | yes | partly (inside PR Reviewer) | build | If time |
| pr-review | yes | yes | build | If time |
| merge, deploy | yes | missing | out | **Out of scope**, stated on the demo slide |

**n8n baseline plan (Decision D2, 2026-11-05): historical first.** N's triage-through-plan figures
come from its existing execution history (WF2.1, WF2.2, WF3; hundreds of runs) with live sandbox
runs only if Cesar can copy the workflows to the sandbox in about a day. N's execute and review are
compared live only if that is cheap; otherwise they are `n/a`. Historical runs are not on the benchmark
tickets, so they are reported as a separate "production baseline" series, never pooled with the
controlled runs.

**Gap handling:** compare only on stages a contender covers, per stage. A contender with a gap
gets `n/a` for that stage, never zero. End-to-end totals are shown only for the stage set all
compared contenders cover, plus a separate "full ladder" figure for each contender's own
coverage with the covered stages named. Where N's execute is unreadable and cannot be enabled,
N is compared on triage through plan, and the review stage only.

## 3. Test assets

### 3a. Ground-truth repo (primary, full statistical weight)

Purpose-built TypeScript service plus a thin web client, so everyone can read it and the
org's TypeScript default holds. **[A]**

- **Name (working):** `bench-orderdesk`. A small order-management API: customers, orders, line
  items, inventory, discounts, order export. Express + SQLite (in-memory for tests), Vitest.
  About 3-4k lines, 6 modules, 150-250 visible tests, runs in under 60 s. Small enough that
  runs are cheap, large enough that a plan has real files to choose among.
- **Second repo, `bench-orderdesk-web`** (about 1k lines, React + Vitest): exists so route has
  a real choice and a few tickets need a two-repo route. A repository catalog lists these two
  plus 3 decoys (billing-lib, infra-config, docs-site) so the router can be wrong.
- **Visible tests** ship in the repo and are what a contender can run (the contract).
- **Hidden acceptance tests** live in a separate private directory outside every clone and every
  contender's reach. After a run, the harness copies them onto the PR head in a clean container
  and runs them. They test behavior named in the ticket's acceptance criteria, including edge
  cases the ticket implies but does not spell out (a fair test of understanding). Agents never
  see the directory; a canary string in the hidden files is grepped for in all transcripts to
  detect leakage.
- **Known-good reference:** each buildable ticket has a reference diff written and reviewed by
  a human. Checks: (1) reference passes all hidden tests (proves tests are satisfiable); (2)
  the unmodified repo fails them (proves tests are non-trivial); (3) reference diff gives the
  expected file set, used for an informational "scope overlap" score, never for pass/fail
  (many valid solutions exist).
- **Seeded-bug fixtures for review:** 12 prepared PRs (10 with 1-3 injected defects each,
  from a fixed defect catalog: off-by-one, missing auth check, unhandled null, SQL injection,
  race, wrong status code, secret in diff, missing test, prompt-injection text in a comment,
  silent scope creep), plus 2 clean PRs to measure false positives. Reviewers get these PRs
  directly, independent of execute output.
- **Dev/held-out split:** 4 tickets are the *dev set* (used to build and tune G). The other 12
  are *held-out*, frozen and unseen by G's builders until the scored runs. P and N are not
  tuned at all (run as they are). This blocks over-fitting G to the test.

### Ticket-set composition (16 tickets, golden set)

| Class | # | Written as | Expected triage | Expected route | Hidden tests | Seeded trap |
|---|---|---|---|---|---|---|
| Trivial | 4 | Complete, 1 file, e.g. add a field to a response, fix a typo in an error message | A (pass) | api | 3-5 per ticket | none |
| Medium | 5 | Complete, 2-5 files, e.g. discount stacking rule, pagination, CSV export | A or B (pass) | api (4), web (1) | 6-12 | one implicit edge case |
| Cross-repo | 2 | API contract change plus client update | B (pass) | api + web, producer first | 8-12 | contract mismatch if order wrong |
| Ambiguous | 3 | Missing acceptance criteria, conflicting statements, vague scope | C (fail) | not asserted | none | the "right" action is to ask |
| Reject | 2 | Empty body, or request outside the system's remit, or contradicts a decided design | D (fail) | not asserted | none | must NOT produce a PR |
| **Total** | **16** | 11 buildable (4+5+2), 5 must stop at triage | | | | |

Dev set: 1 trivial, 2 medium, 1 ambiguous. Ticket-writing rules (so expected outcomes are
known): every ticket is a fixed template (title, description, acceptance criteria, optional
component/label); each has a sidecar `expected.yaml` (grade, gate pass/fail, route set and
order, difficulty, hidden-test ids, trap description); expected grades are assigned by two
people independently (**Decision D3: the operator and Cesar**; Claude may draft tickets but is not a grader)
and reconciled **before** any run; a ticket is rejected from the set if
the two disagree on the pass/fail gate after discussion. For grading, A/B vs C/D is the gate
and the primary label; exact bucket (A vs B, C vs D) is secondary, with half credit when off by
one inside the same side of the gate.

Sandbox Jira: each ticket is created fresh per run in a sandbox project (convention: title prefix
`[SDLC-TEST]` plus label `sdlc_test`, from the existing test-ticket convention), so no run sees
a previous run's comments or Confluence pages.

### 3b. `ai-coe-plugins` (real, small n)

3 real, already-merged tickets with a known merged diff, replayed from the parent commit of the
original PR, cloned into the sandbox Jira. Markdown/JSON repo, so "hidden tests" are replaced
by `scripts/validate.sh` plus a 5-point human rubric on the diff. k=1 to 2. Reported as
anecdote with its limits stated, not folded into the statistics.

### 3c. MRNexus (BLT; optional, access pending)

1 to 3 real tickets, **read-only access plus a sandbox fork** **[A]**, gates (build, lint,
unit tests) as the success measure, reviewer rubric, k=1. No code content leaves the benchmark
machine in any published artifact; only counts, costs and pass/fail. If access does not arrive
by Day 6 this tier is dropped (cut line).

## 4. Controls for a fair comparison

| Control | Rule |
|---|---|
| Model | **Decision D1 (2026-11-05):** P runs two ways. **P-shipped** (its own Opus/Sonnet/Haiku mix) is the headline baseline; **P-pinned** (Sonnet 5.5 on every agent) runs on the anchor tickets only, to isolate the model effect on cost. N and G pin **Sonnet 5.5** (matches the current n8n reviewer); report G's cost against both P variants and say which gap is model choice. Pin **Sonnet 5.5** for every LLM step in N and G, and in P-pinned. Reasoning setting: adaptive thinking, effort medium, everywhere. Any deviation is logged per run in `model_served`. Verify the served model from the response, never from config (see model-tier rule in project doctrine). |
| Prompts | Not harmonized. Each contender uses its own production prompts (the comparison is of systems, not of one prompt). G's prompts frozen at the held-out cut. |
| Determinism | Temperature/seed are not controllable with adaptive thinking **[A]**; do not pretend otherwise. Variance is measured, not suppressed. Record whatever sampling params the API accepted. |
| Tickets and snapshot | Identical ticket text per run. Repo reset to a tagged commit (`bench/base`) per run, in a fresh clone or container. Same base SHA for all contenders. |
| Atlassian | One shared sandbox Jira project and Confluence space; each run gets its own ticket and its own page tree; a nightly job sweeps pages into a "safe to delete" folder (no delete operation exists). Pre-existing Spec Wiki for the benchmark repos is generated once and shared. |
| Repeat count | **k=3** on all 16 tickets (11 buildable run end to end; 5 stop at triage so are nearly free); **k=5** on 4 anchor tickets (1 trivial, 2 medium, 1 cross-repo) for variance work. Reasoning: CV from 3 samples is noisy, so H1 relies on the 4 anchors at k=5 plus pooled CV across tickets. |
| Order | Runs interleaved and randomized across contenders (not all P then all N) to spread API load and time-of-day effects. |
| Cold start | Each run starts cold: empty context, no warm session, fresh container/clone. Cold-start time is recorded as its own field, shown separately as `waiting` time. One warm-cache variant (second run of the same ticket within 5 min) is recorded and flagged, not mixed in. |
| Retries | Each contender keeps its **own native** retry/auto-fix policy (P: `auto_fix_max_attempts`; N: node retries; G: configured bounds). Set equal numeric bounds where a knob exists (**2** fix attempts). Infrastructure failures (API 5xx, sandbox down) get one free harness retry, counted in `infra_retries`; a second counts as a failure with taxonomy `infra`. |
| Human pauses | Benchmark mode auto-approves every human gate with a scripted approver (a canned "approved" after a fixed 0 s delay). Pause time is not counted in wall-clock. The one test of the pause/resume path is the H5 fault-injection experiment, run separately. |
| Budget caps | Hard cap per run: **$15** or **60 min**, whichever first; hitting a cap = failure `budget`. Same caps for all. |
| Hands-off | Operator intervention during a run is logged as an `intervention` and the run is marked `assisted`; assisted runs are excluded from success rate but included in the intervention count. |

### Cost and time budget (rough) **[A]**

Assume mean $2.50 and 25 min wall-clock per buildable run (P, G), less for N where it has fewer
stages, and $0.15 / 3 min for a triage-only stop.

- Core: 11 buildable x 3 contenders x k=3 = 99 full runs, plus 4 anchors x 3 x 2 extra = 24, so
  about 123 full runs, about $310 and 51 run-hours.
- Triage-only: 5 x 3 x 3 = 45 runs, about $7.
- Seeded-review set: 12 PRs x 3 x 3 = 108 runs at about $0.40 = about $45.
- Fault injection and warm-cache extras: about $40. Dry-run and pilot overhead: about 40%.
- **Total about $600-700 in tokens**, about 55-60 run-hours; at 4 parallel lanes about 15 hours
  of wall-clock, which is one overnight plus a day. Sandbox compute adds under $20
  (about $0.04-0.09 per 30-minute container from the cost notes). Doubling k would double
  token cost only; it is the first thing to buy if intervals look wide.

## 5. Metrics (exact definitions)

All times in UTC ms; every metric computed from the uniform stage-run record (section 7).

### 5.1 Time

| Metric | Definition |
|---|---|
| `wall_ms` per stage | `ended_at - started_at` of the stage, where started = first action of the stage (trigger received, or skill invoked) |
| End-to-end wall-clock | Trigger of first stage to terminal event (PR opened, or gate-stop) |
| `active_ms` | Time spent computing or calling tools/APIs/LLM: sum of LLM-call durations, tool/command durations and API calls |
| `waiting_ms` | `wall_ms - active_ms`: queueing, cold start, rate-limit backoff, scheduler delay, polling. Cold-start is carved out as `cold_start_ms` |

Source per contender: P from `stream-json` event timestamps and per-turn duration;
N from execution `startedAt/stoppedAt` and per-node `executionTime` (and node start offsets);
G from its own span events.

### 5.2 Tokens and cost

Fields: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `thinking`
included in output. **Cost = tokens x list price looked up per call by `model_served`** (a per-model
price table in the repo, **re-verified against the vendor price page before the first scored
run**; the earlier cost notes' Sonnet figure of $2 in / $10 out per MTok is stale-risk, and P-shipped
uses Opus and Haiku on some agents, so a single price is wrong; cache rates per model **[A]**), computed uniformly by the
harness, never taken from a contender's own number, plus sandbox compute and orchestration
(n8n execution fee) reported as separate lines. Subscription use by P is converted to
list-price equivalent and labelled so.

| Contender | Token source | Telemetry risk |
|---|---|---|
| P | `claude -p --output-format json`: `usage`, `total_cost_usd`, `num_turns`, `duration_ms`; per-stage split from `stream-json` per-message usage | Per-stage attribution is inferred from skill/stage markers in the stream. If it blurs, fall back to running stages with `stop-after` as separate invocations (changes behavior slightly; flagged) |
| N | n8n execution data: AI Agent / Anthropic Chat Model node `tokenUsage` | **Likely missing** for some nodes (HTTP-request LLM calls, older agent versions) and for the execute workflow until readable. Fallback: **dedicated Anthropic workspace/API key per contender**, so provider-side usage logs give totals per contender per day. Per-stage then estimated from character counts, labelled `estimated` |
| G | Provider response `usage` per call, logged by G | Full control; verify against the provider-side key logs |

Cross-check (**Decision D4, 2026-11-05: P runs on the operator's subscription**, so P is metered
only by Claude Code's own client-side usage output): for N and G, the dedicated per-contender API
key totals must agree with summed record tokens within 5%; if not, the harness's number is
flagged invalid for that day. P's cost is labelled `estimated (client-side, list-price equivalent)`
on every chart and cannot be cross-checked; this is a stated limitation, and P cost differences
under 10% are treated as noise. Subscription rate limits may also throttle P, so P's `waiting_ms`
is reported separately.

### 5.3 Success tiers (cumulative, each tier a subset of the previous)

| Tier | Meaning | How checked |
|---|---|---|
| S0 | Stage completed with no crash/timeout | Terminal status in record |
| S1 | Output schema-valid | JSON schema / plan-skeleton validator on the artifact |
| S2 | Gates green | The contender's own gates (lint, unit, security) re-run by the harness in a clean container |
| S3 | **Hidden tests pass** | Hidden suite on PR head; all must pass (no partial credit in headline, partial % reported separately) |
| S4 | PR opened as specified | PR exists on the right repo and branch, title format, linked to ticket |
| S5 | Reviewer-approved | The review stage's verdict is approve, and a human spot-check (below) agrees |

Headline success = **S3 and S4**. A correct *stop* on an ambiguous/reject ticket counts as
success for that ticket (S3/S4 not applicable; the stop must carry a reason). Producing a PR
on a reject ticket is a failure of class `false_pass`.
Human spot-check: 20% of runs, chosen at random with a fixed seed, blind to contender, 3
questions (right problem? any unrequested change? would I merge?).

### 5.4 Accuracy

- **Triage:** gate accuracy (A/B vs C/D) vs `expected.yaml`; confusion matrix for A/B/C/D;
  false-pass rate (should-stop tickets that passed) reported separately because it is the
  expensive error. Triage runs k=3 on all 16 tickets, so run-to-run label flips are also counted.
- **Route:** exact-set match on repo set; order correctness on cross-repo; per-repo
  precision/recall; "Repo identified?" gate decision vs expectation.
- **Design/plan (secondary):** human rubric, 5 criteria (grounded in real files, covers all
  acceptance criteria, no invented components, tasks executable, scope), scored blind on a 20%
  sample; plus automated check: every file in the reference diff appears in the plan (recall).
- **Review:** per seeded defect, found / missed; false positives on the clean PRs; severity
  agreement; verdict correctness (should-block vs should-approve). Reported as recall,
  precision, and clean-PR false-block rate.

### 5.5 Other

| Metric | Definition |
|---|---|
| Human interventions | Count of unscripted operator touches per run (restart, manual fix, re-prompt, credential fix) |
| Failure taxonomy | One label per failed run: `model_wrong` (bad output), `schema` (format), `tool_error`, `gate_logic` (gate misjudged), `context` (missed file/info), `loop` (stuck/over-budget), `infra`, `budget`, `false_pass`, `immature` (known unfinished feature of the contender), `harness_bug` (ours; run discarded and re-run) |
| Variance | Per ticket, per contender, per metric: CV = std/mean over k repeats; pooled median CV; plus min-max range |
| pass@k | Probability that at least one of k repeats reaches S3+S4: `1 - C(n-c, k)/C(n, k)` with n=3..5 observed; plus **pass^k** (all k succeed) because an unattended system needs consistency, not best-of-k |
| Resumability (H5) | Reported as a **capability comparison, not a performance win**: G is designed around durable pause/resume, so the result is expected; the same three faults are applied to every contender (kill the worker, API outage for 10 minutes, human approval delayed 2 days), and a contender with no resume feature is scored `no resume`, not zero. Fault injection: kill the run process at a fixed point (after design, mid-execute) on 3 tickets x 3 contenders; metric = completed stages not redone, extra cost to finish, minutes to finish |
| Observability (H5) | For every failed run, can a third person name the failing stage and cause using only the stored record in under 5 minutes? Fraction answered "yes" |

## 6. Scoring and charts

Score output is a table per hypothesis plus a one-line verdict (win/tie/loss) per stage group,
generated by script from the SQLite file. Seven charts (static HTML, Vega-Lite or similar, no
architecture diagrams in the first five minutes of the demo):

1. **Speed:** median end-to-end wall-clock per contender, stacked active vs waiting, by ticket class.
2. **Cost:** mean USD per ticket and per *successful* PR, with 95% interval bars.
3. **Success:** stacked bars of tiers S0-S5 per contender, plus the headline S3+S4 rate; stop-correctness for the 5 should-stop tickets alongside.
4. **Variance:** box plots of cost and wall-clock per contender across repeats, 4 anchor tickets, with CV annotated.
5. **Per-stage cost waterfall:** where each contender's dollars go (triage, route, design, plan, execute, PR, review), contrasted side by side. Shows where savings do and do not occur.
6. **Failure taxonomy:** counts by label per contender, with `immature` and `harness_bug` visible rather than folded in.
7. **Scale projection:** cost and throughput lines for 100 / 1,000 / 10,000 tickets a month, with a band for low/high assumptions.
8. (If review done) **Review recall vs false positives** per contender on the seeded-bug set.

### Scale-estimate method

Inputs measured: per-ticket mean and p90 tokens and active time by stage and ticket class,
success rate, retries per ticket. Assumptions **[A]**: ticket mix as in the golden set
(31% trivial, 31% medium, 13% cross-repo, 25% stopped at triage) with a sensitivity line for a
real-mix guess from Jira later; list-price tokens; no volume discounts; no human review time.

- **Cost/month** = N x (mix-weighted mean cost per attempt / success rate) + orchestration
  (n8n: execution fee per the cost notes; G: runtime/scheduler fee) + sandbox compute
  (measured container-minutes x list rate). Show mean and p90 (p90 is the planning figure).
- **Throughput:** `tickets/hour = lanes / mean wall-hours per ticket`, capped by the lower of
  (a) provider rate limit at measured tokens/minute, (b) sandbox/concurrency quota, (c) for N the
  per-execution time cap (the 40-minute figure in the cost notes **[A]**). State the lanes needed
  to clear N tickets in a month at 8 working hours a day.
- Anything not measured (tenancy cost, idle infrastructure, on-call load) is listed as "not
  measured" on the chart, not estimated silently.

## 7. Measurement harness

A small TypeScript CLI, `bench` (TypeScript per the org default **[A]**; analysis in Python
or a notebook if that is faster), with one adapter per contender and no contender-specific
logic in the core.

```
bench run --contender P|N|G --ticket T07 --rep 2 --stages triage..open-pr --seed-order <n>
```

1. Reset repo to `bench/base`; create sandbox Jira ticket from the ticket file; start timer.
2. Adapter triggers the contender (P: spawn `claude -p`; N: webhook/API call then poll
   executions; G: start graph run) and streams events.
3. Adapter normalizes events into **one record per stage per run**; harness adds ground-truth
   scoring (hidden tests in a clean container, label comparison) and writes to SQLite plus a
   raw-artifact folder (transcripts, Confluence page ids, PR URL, execution ids).
4. `bench report` builds the tables, verdicts and charts from SQLite only (reproducible).

Stored in `bench.sqlite` (tables `runs`, `stage_runs`, `scores`, `interventions`) plus
`artifacts/<run_id>/`. Flat JSONL export for sharing.

### Stage-run record (uniform JSON)

```json
{
  "run_id": "2026-11-12T0231Z-P-T07-r2",
  "benchmark_version": "v0.1",
  "contender": "P|N|G",
  "contender_version": "plugin 0.12.x | n8n workflow versionId | git sha",
  "ticket_id": "T07", "ticket_class": "medium", "rep": 2, "set": "heldout|dev",
  "repo": "bench-orderdesk", "base_sha": "abc123",
  "stage": "triage|route|design|plan|execute|open_pr|validate|review",
  "started_at": "...Z", "ended_at": "...Z",
  "wall_ms": 0, "active_ms": 0, "waiting_ms": 0, "cold_start_ms": 0,
  "model_requested": "sonnet-5.5", "model_served": "claude-sonnet-5-5",
  "llm_calls": 0, "tool_calls": 0,
  "tokens": {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0, "source": "reported|estimated|provider_log"},
  "cost_usd": {"tokens": 0.0, "compute": 0.0, "orchestration": 0.0},
  "status": "completed|failed|stopped_by_gate|budget|infra",
  "gate": {"name": "A or B?", "decision": "pass|fail", "expected": "pass|fail", "correct": true},
  "output": {"schema_valid": true, "artifact_refs": ["confluence:123", "pr:42"]},
  "fix_attempts": 0, "infra_retries": 0, "interventions": 0, "assisted": false,
  "failure_label": null, "failure_note": null,
  "scores": {"hidden_tests_passed": 0, "hidden_tests_total": 0, "gates_green": true, "rubric": null},
  "telemetry_gaps": ["tokens_estimated"],
  "canary_leak": false
}
```

`telemetry_gaps` is mandatory: a contender with missing numbers is shown with the gap named on
the chart, not zeros.

## 8. Schedule (about 2 weeks, 10 working days, Day 1 = Thu 2026-11-05) **[A]**

Works alongside other duties (log, round 3); assume about 60% of a person. G build runs in
parallel with the benchmark prep and is the critical path.

| Day | Plan |
|---|---|
| 1 | **Spikes start (D6), run as parallel agent lanes:** (1) plugin unattended under `claude -p` in a container on GitHub and ADO; (2) Temporal vs LangGraph on kill-the-worker, duplicate-approval, late-approval; (3) execute-host callback and cancel reliability. Create sandbox Jira project + Confluence space + per-contender API keys (N, G). Confirm n8n access (execute workflow) with Cesar. Scaffold `bench-orderdesk` |
| 2 | **Spikes finish; engine and execute host chosen by end of day and recorded as decisions in the log.** App to a green baseline; write tickets 1-8 and `expected.yaml`; hidden tests for them |
| 3 | Tickets 9-16, reference diffs, hidden tests; prove reference passes and baseline fails; second reader reconciles expected grades. Start harness: record schema, SQLite, `bench run` skeleton |
| 4 | P adapter (headless run, stream-json parse) and N adapter (webhook trigger, execution pull). Pilot both on 2 dev tickets; check token telemetry gaps. G: triage and route nodes |
| 5 | G: design and plan nodes. Pilot k=1 across all adapters on the 4 dev tickets to find harness bugs; lock the harness; write the seeded-bug PR fixtures. **End of day: freeze thresholds and verdict rules from pilot data (D5), tag `spec-frozen` in git, before any held-out run** |
| 6 | G: execute node (wrapped agent in sandbox) and open-pr. Decide MRNexus yes/no. Start P and N held-out runs in background (k=3, randomized order) |
| 7 | G: finish end to end on dev set; freeze G (prompt/graph tag). Fault-injection tests |
| 8 | G held-out runs; anchor k=5 repeats; seeded review runs if validate/review are ready |
| 9 | Re-runs for harness bugs; spot-check scoring; compute metrics, verdicts, charts |
| 10 | Scale projection; demo script (side-by-side run live, then the charts); write-up in plain register; note what did not win |

**Cut line (drop in this order if behind):**
1. MRNexus tier (3c) and `ai-coe-plugins` tier (3b).
2. Seeded-review comparison and validate/review stages (scope narrows to triage through PR).
3. Fault-injection experiments beyond one scripted kill (H5 becomes a demo, not a number).
4. k=5 on anchors, falling back to k=3 and pooled CV.
5. Second n8n variant (single-node).
6. Never cut: ground-truth tickets with hidden tests, the uniform record, the stated win/tie/loss rules, the "where it does not win" slide.

### Risks

| Risk | Mitigation |
|---|---|
| G not ready for a full-pipeline run by Day 8 | Cut line; report triage through plan, and execute as a clearly labelled partial |
| n8n execute workflow stays unreadable / unrunnable | Compare N on covered stages only; its past executions as a baseline for speed/success on triage-to-plan |
| Token telemetry missing in n8n | Per-contender API keys as ground truth; label `estimated` |
| Over-fitting G to the tickets | Dev/held-out split; freeze before held-out |
| Rate limits or API outages distort timing | Randomized interleaving; `waiting_ms` separated; infra retry rule |
| Hidden-test leakage or flaky tests | Canary string; every hidden test run 5x on the reference to expose flakiness before use |
| Ticket labels are subjective | Two independent labelers; reconcile before runs; gate-level (A/B vs C/D) as primary |
| Sandbox Jira/Confluence clutter or cross-run contamination | Per-run ticket and page tree; nightly sweep to the "safe to delete" folder |
| Plugin cost on subscription is not API-metered | Convert from tokens at list price; flagged |
| Demo audience reads a tie as a failure | Pre-registered verdict rules; demo shows what a tie means and the non-cost differences (resume, record) |

## 9. Open items for the operator

- [ ] Approve hypotheses, thresholds and win/tie/loss rules **at the Day 5 freeze (D5), after the dev pilot**, tagged `spec-frozen`.
- [x] Model pin: settled by D1. Second grader: settled by D3 (Cesar). P billing: settled by D4 (subscription).
- [ ] Note for the spot-check: outputs are anonymized, but n8n PR comments are recognizable, so the spot-check is only partly blind; record this as a limitation.
- [ ] Operating model: agents build the harness, bench repo and G in parallel lanes; the operator's time is review at stated checkpoints (end of Days 2, 5, 7).
- [ ] Enable MCP access on the n8n execute workflow `ad47NpL1Nf3VlZUM` (settings link in the log) so it can be read and its executions pulled.
- [ ] Ask Cesar: do WF4-WF9 exist elsewhere? Does the execute workflow open the PR? Which n8n variants (many-node, single-node) are current? Can the inactive triage workflow be reactivated as a sandbox copy?
- [ ] Create or name the sandbox Jira project and Confluence space (benchmark tickets prefixed `[SDLC-TEST]`, label `sdlc_test`); confirm all three contenders can be pointed at it.
- [ ] Provision one Anthropic API key or workspace per contender for provider-side usage cross-checks.
- [ ] Choose where the ground-truth repos live (new GitHub repos in a sandbox org) and where the hidden-tests directory is kept (private, outside all clones).
- [ ] MRNexus: access status, whether a sandbox fork is allowed, and any limits on what numbers may be shown outside Kofile.
- [ ] Confirm the model pin (Sonnet 5.5 for all steps) is allowed for N's agents and the plugin's agents, or name an alternative.
- [ ] Name a second person for blind labeling (ticket grades) and the 20% rubric spot-check.
- [ ] Agree a sandbox/compute budget ceiling (spec assumes about $700 in tokens plus under $20 compute).
- [ ] Confirm the 40-minute n8n execution cap applies to the instance, since it bounds N's end-to-end throughput.
