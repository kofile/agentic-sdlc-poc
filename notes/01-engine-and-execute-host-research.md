# 01 — Orchestration engines and execute-node hosting: neutral research

Date: 2026-11-04. Status: DESCRIPTIVE research for a design discussion; no winner is declared.
Method: prior-art vault notes (tag `research/vault-v1`, written 2026-10-06/07) reused, then key facts
re-fetched on 2026-11-04. Every non-obvious claim carries a source tag `[S#]` resolved in the Sources
list. Anything not verified is marked **UNVERIFIED**. "Vault" means the prior-art notes (re-verified only where tagged `[S#]` with a 2026-11 URL).

Grades use the project's three axes (High/Med/Low; **for maintenance load, High = heavy burden for AICOE**,
so lower is better; for the other two, High = good):
**M** = AICOE maintenance load, **C** = customer ease of adoption, **A** = adaptability.

Draft stage shapes being modelled (from `00-discovery-log.md`):
- **Typed function** (schema in/out, code decides, fail closed): triage, repo-route, merge-verdict, pr-review.
- **One-shot generation** (+ optional human review loop): design, plan, qa-plan.
- **Pure code**: open-pr.
- **Agentic coding loop needing a sandbox** (checkout, shell, tests, git): execute + validator-fixer, pr-fixer, root-cause-fixer.

---

## 0. Reading guide and the three load-bearing findings

1. **Separate "the graph" from "the coding agent."** Every engine below can wait days for a human. None of
   them is a coding harness. The execute node is a call out to a sandbox that runs an existing harness; the
   engine only needs: start (idempotent), wait (long or callback), read result, cancel.
2. **The pause/resume primitive differs in kind, not degree.** Three families:
   - *Replay-based durable execution* (Temporal, Restate, Inngest, Durable Functions): code re-runs from the
     top and completed steps return recorded results; waiting costs nothing.
   - *Checkpoint-based graph state* (LangGraph, Mastra): state snapshot after each node/step; resume restarts the
     interrupted node, not the exact line.
   - *Declarative state machine* (Step Functions, Logic Apps): the definition is data; pause = a task token.
   These differ in how gate policy "as data" and "custom gate" extension are expressed (section A.4).
3. **Cost is dominated by tokens, not by orchestration or compute.** Anthropic's own hosting guide says token
   cost "typically dominates container infrastructure cost by an order of magnitude or more" with a minimal container
   at roughly $0.05/hour [S1]. Orchestrator prices below are nearly noise next to a Sonnet/Opus coding loop
   (Sonnet 5 $2/$10 per MTok in/out list; Opus 5 $5/$25 [S2]). Pick engines on semantics and operability, not unit price.

---

# PART A — Orchestration / graph engines

## A.1 Per-engine facts

### LangGraph (JS and Python) + LangSmith Deployment (formerly LangGraph Platform)
- **Model.** Stateful graph of nodes with a typed state; a *checkpointer* persists state per `thread_id`. JS and
  Python both first-class [S3].
- **Checkpointers.** `MemorySaver`/`InMemorySaver` (lost on restart, not for production), `SqliteSaver` (dev),
  `PostgresSaver` (production) [S4]. Long threads accumulate checkpoints; docs recommend pruning/retention [S4].
- **Interrupt / resume.** `interrupt(value)` suspends the graph and returns `value` under `__interrupt__`;
  resume with `new Command({ resume })` and the same `thread_id`; checkpointer required [S3].
  Caveats from the docs: the node **restarts from its beginning on resume** so pre-interrupt side effects must be
  idempotent; do not wrap `interrupt()` in bare try/catch (it throws); multiple interrupts in one node match by
  position [S3]. Arbitrary durations are limited only by the store, not by a process.
- **Replay / time travel.** Listed as a checkpointer use case [S4]; fork/replay specifics and "durability modes"
  were not on the fetched pages — **UNVERIFIED**.
- **LLM call modelling.** Model is just a function in a node; retries via node-level retry policy (**UNVERIFIED
  on fetched pages**); structured output via the model provider integration (Zod/Pydantic). No built-in
  memoisation of an LLM call across a crash other than "node already checkpointed".
- **Observability.** LangSmith tracing (paid SaaS; also self-hostable on Enterprise) [S5]. Time-travel UI in LangGraph Studio (**UNVERIFIED** this pass).
- **Managed offering.** LangSmith Deployment: Developer $0/seat; Plus $39/seat/month + pay-as-you-go; Enterprise
  custom (SLA, hybrid = SaaS control plane + your data plane, or fully self-hosted in your VPC). Serverless (scales to
  zero) vs Dedicated (always on). Metering in "LSU" ($1 each): runtime 0.0675 LSU/vCPU-h, 0.0090/GiB-h; database
  0.177/vCPU-h, 0.025/GiB-h. US or EU cloud regions [S5]. No separate per-node execution price on the page [S5].
- **Extension model.** Nodes/edges are code; conditional edges are the gate. Config-as-data is possible by building
  the graph from a config at compile time, or passing config in `configurable`; there is no first-class "policy"
  concept (it is a library, not a policy engine).
- **Lock-in.** Library is MIT/OSS (**license UNVERIFIED** this pass). Checkpoint schema and Platform API are
  LangChain-specific; Postgres is yours either way.
- **Maturity.** Widely adopted; the framework API has changed several times across 2024-2026 (**UNVERIFIED**
  detail; the interrupt API above is the current documented one).
- **Hyperscaler fit.** AgentCore Runtime documents LangGraph as a supported framework [S6]; Foundry hosted agents list LangGraph [vault: Managed-Agent-Runtimes].

### Temporal (TypeScript SDK, Temporal Cloud)
- **Model.** Replay-based durable execution. Workflows (deterministic code) call Activities (side effects, including
  LLM calls and sandbox starts); history is event-sourced; a worker you host executes code, the service holds state [S7].
- **Pause / resume.** Workflows wait on Signals, Updates, and durable Timers at zero compute cost; "Message
  passing" and "Timers" are first-class TS SDK topics [S7]. Wait durations are long (days+); Cloud max not captured — **UNVERIFIED** exact limits (history size/Continue-As-New applies).
- **HITL.** Signal/Update from your API (e.g. a Jira webhook handler or Teams button) resumes the workflow.
  Per-team gate policy = workflow input/search attribute/config activity.
- **LLM call modelling.** An Activity with a retry policy and timeouts; heartbeats for long calls; the result is
  recorded in history, so a replay never re-calls the model (that *is* exactly-once-ish memoisation). TS SDK docs
  list integrations for the **Vercel AI SDK, OpenAI Agents SDK, Google ADK, Strands Agents, LangSmith, Braintrust,
  Laminar, and Mastra** [S7]. Structured output = your code validates inside the Activity.
- **Observability / replay.** Web UI shows event history per workflow; deterministic replay and a replayer for
  testing workflow changes; workflow versioning/patching needed for in-flight changes (cost of the model).
- **Managed offering and cost.** Temporal Cloud: Actions $50 per million down to $25/M (self-serve tiers); active
  storage $0.042/GB-h, retained $0.00105/GB-h; no base fee on pay-as-you-go; $150 credits for 90 days; Business support from $500/mo
  or 10% of usage; Enterprise/Mission Critical custom [S8]. Cost sanity: a 30-Action ticket run costs ~$0.0015 — negligible [S8 arithmetic].
- **Extension model.** Interceptors (SDK-level hooks around workflow/activity calls) are the hook point
  (**UNVERIFIED** this pass; it is a documented Temporal feature but not re-fetched). Custom stage = new workflow/activity code.
- **Lock-in.** Server is OSS and self-hostable; SDK API is Temporal-specific; code is plain TS. Medium.
- **Maturity.** Highest of the code-first engines; large production base (**UNVERIFIED** specifics).
- **Fit gotcha.** You must run and scale **workers** (containers on ECS/AKS/ACA) even with Cloud; determinism
  rules are a learning cost for the team writing workflows.

### Inngest
- **Model.** Event-driven durable functions: `step.run`, `step.sleep`, `step.waitForEvent`; steps are memoised, the
  function is re-invoked over HTTP, and Inngest orchestrates; your code runs on your own HTTP endpoints/serverless [S9][S10].
- **Pause / resume.** `step.waitForEvent` pauses until a matching event or timeout, returns the event or `null`; no
  process runs while waiting; only events sent *after* the wait starts match; docs example uses a 7-day timeout and do not state a max (check platform limits) [S10].
- **HITL.** Send an event (e.g. `ticket/design.approved`) from your API/Jira webhook; match on a data field.
- **LLM call modelling.** A `step.run` is retried and memoised; an AI-specific `step.ai` + AgentKit exist per the vault
  (secondary sources) but were **not on the fetched Inngest pages — UNVERIFIED**. Pricing page notes AI agents with tool
  calls/retries "can often use 10+ executions per run" and mentions Agent Evals [S9].
- **Observability.** Dashboard with run timeline/replay; Pro and above (**details UNVERIFIED**).
- **Managed + cost.** Free $0 (50k executions, 5 concurrent steps); Pro from $99/mo (1M executions, 100+ concurrent steps);
  Business from $499/mo (10M, 500); Enterprise custom with SAML, RBAC, audit, HIPAA. Each step counts as an execution
  (5 `step.run` = 6 executions) [S9]. Core engine is open source and self-hostable [S9] (license **UNVERIFIED**).
- **Extension.** Middleware hooks (**UNVERIFIED** this pass); events decouple stages nicely (gate = event subscription).
- **Lock-in.** Medium: SDK is Inngest-specific; engine is OSS.
- **Maturity.** Production-grade for TS; narrower than Temporal in enterprise adoption (**UNVERIFIED** opinion — treat as a spike question).
- **Fit gotcha.** Steps run inside HTTP request time limits of the host (e.g. serverless); a long agent loop must NOT be a single step — it must be an external call plus an event callback. That is the intended pattern for our execute node anyway.

### Restate
- **Model.** A lightweight server that journals handler progress (durable execution) for services, workflows and "AI
  agents"; SDKs for TypeScript, Java, Kotlin, Python, Go, Rust, Ruby [S11]. Workflows used for long-running processes,
  human approvals, and webhook waits [S11]. Durable promises/awakeables are the HITL primitive (**not on fetched page — UNVERIFIED by fetch**, standard Restate concept).
- **Deployment.** Restate Cloud (managed), Restate BYOC (managed in your cloud account/VPC), self-hosted [S11]. BYOC is
  attractive given Kofile's AWS/Azure agreements.
- **Pricing.** Not retrieved (pricing page returned no figures) — **UNVERIFIED**. Vault notes a $20M Series A on 2026-09-30 (secondary) [vault: Durable-Orchestrators].
- **License.** Believed source-available (BSL-style) — **UNVERIFIED**.
- **LLM modelling.** `ctx.run` durable steps; docs link a Vercel AI SDK "agents tour" [S11] (details UNVERIFIED).
- **Maturity.** Youngest of the group; strong design, smallest ecosystem and operator community. Medium-high risk for a company-wide platform.

### Mastra (TypeScript)
- **Model.** TS agent/workflow framework. Workflows with `suspend()` / `resume()`; each step can define `suspendSchema`
  and `resumeSchema`, so human input is typed (Zod) [S12].
- **Durability.** Suspended runs are stored as **snapshots in the configured storage provider**; snapshots persist across
  deployments and restarts; resume from an HTTP endpoint, event handler or timer; `getWorkflowRunById()` rehydrates [S12][S13]. Storage options LibSQL/Postgres [S13].
  Note this is checkpoint-style durability, not event-sourced replay; mid-step crash behavior is **UNVERIFIED**.
- **LLM modelling.** Native agents and structured output through the Vercel AI SDK model router (**UNVERIFIED** this pass).
- **Managed.** "Mastra Platform" with Starter (free, pay-as-you-go allowances) and Teams tiers; blog dated July 2026;
  figures not retrieved [S14] — price **UNVERIFIED**. Temporal's TS docs list a Mastra integration [S7].
- **Maturity.** Fast-moving, newer; API churn risk. Good ergonomics for "typed function" and one-shot stages.

### AWS Step Functions (+ Azure Durable Functions / Logic Apps)
**Step Functions** (the AWS-agreement option):
- **Model.** Declarative state machine (Amazon States Language), Standard workflows up to **1 year**; Express 5 min
  [vault: Durable-Orchestrators; S15]. `.waitForTaskToken` pauses a Task until `SendTaskSuccess/Failure` arrives, until the
  1-year quota; use `HeartbeatSeconds` to avoid stuck executions [S15]. Task tokens must come from principals in the same AWS account [S15].
- **ECS/Fargate** supports both `.sync` (wait for the task to finish) and `.waitForTaskToken` [S15]; Bedrock supports both; **Bedrock AgentCore integration supports request-response only (no `.sync`/token)** as of that page [S15].
- **HITL.** Task token to SQS/SNS/API Gateway/Lambda and a human UI that calls `SendTaskSuccess`; clean, but the "UI" is yours.
- **LLM call modelling.** Bedrock `InvokeModel` integration, or a Lambda/Fargate task; Retry/Catch fields give declarative retries; no
  structured-output helper — validation lives in your Lambda/Choice state.
- **Observability.** Execution history graph in console, CloudWatch, X-Ray; redrive of failed executions (**UNVERIFIED** this pass).
- **Cost.** $0.000025 per state transition (Standard) [vault: Durable-Orchestrators]; negligible.
- **Extension.** Gate policy as data is natural: Choice states read from the input JSON; custom stage = new state + Lambda/container. Definitions are JSON/ASL, which is awkward for TypeScript-first developers (CDK/ASL builders mitigate; **UNVERIFIED**).
- **Lock-in.** High to AWS; the contract is the ASL definition. A team on Azure DevOps/Azure cannot reuse it.
- **Maturity.** Very high.

**Azure Durable Functions**: orchestrator/activity/entity functions in code; runtime "manages state, checkpoints, retries, and recovery";
languages include C#, JavaScript, **TypeScript**, Python, Java, PowerShell; recommended backend is the **Durable Task Scheduler** (managed) [S16].
Human-interaction/external-event pattern is the standard approach (**not on the fetched page — UNVERIFIED by fetch**).
It is the Azure analogue of Temporal-style replay (code constraints apply [S16]). **Logic Apps**: low-code connectors, Azure-side analogue to n8n — **UNVERIFIED** (not researched this pass).
**Cross-cloud note:** picking one hyperscaler engine makes the other cloud's customers second-class; this matters because repos are on both GitHub and Azure DevOps.

### n8n (as trigger/glue, or as the engine)
- **Cloud limits.** Execution counts per workflow (not per node); Cloud plans cap duration (Pro/Enterprise table says 40 min; a staff post says Cloud "doesn't enforce a strict short execution timeout"; **whether Wait-node time counts: not found**); no Execute Command, no custom nodes, Code node has no filesystem or HTTP on Cloud [vault: n8n-Cloud-Constraints].
  Self-hosted (Business €667/mo for 40K executions, Enterprise quote) has those freedoms but is a thing to operate [vault: n8n-Cloud-Constraints; Cost-Inputs].
- **Pause/resume.** Wait node resumes "with the same data" after a duration or a webhook [S17]; persistence/limits not documented on the fetched page.
- **HITL.** Wait-on-webhook/form; approval via chat nodes.
- **LLM calls.** AI Agent/LLM nodes with structured output parsers; retry-on-fail per node; each agent message counts as one execution [vault: n8n-Cloud-Constraints].
- **Observability.** Per-node execution viewer, log retention 7/30 days or unlimited on Enterprise [vault: n8n-Cloud-Constraints]. Genuinely good for operators who are not developers.
- **Fairness note for the n8n owner.** n8n is the best-in-class *integration surface* (hundreds of connectors, a visual editor non-engineers can read, an existing team and an existing implementation of this very pipeline). Its weak points for *this* design are specific, not general: no shell/filesystem on Cloud, workflow definitions as JSON (diff/review/test ergonomics), per-team policy-as-data and golden tests are bolted on, and "graph inside a stage" would need sub-workflow sprawl. Using it as the **trigger/glue** layer (Jira webhook in, call engine, chat notifications) removes most of those weak points while keeping its strengths.
- **As glue.** n8n starts the engine with one HTTP call and receives callbacks — all engines above accept that. It is the lowest-risk way to keep the n8n owner whole.

## A.2 Comparison table

| | LangGraph | Temporal | Inngest | Restate | Mastra | Step Functions | Azure Durable Fn | n8n |
|---|---|---|---|---|---|---|---|---|
| Durability type | Checkpoint | Event-sourced replay | Step memoisation | Journal replay | Snapshot | State-machine history | Replay | Execution store |
| Pause/resume | `interrupt` + `Command(resume)`, restarts node | Signal/Update/Timer, zero cost | `waitForEvent` (null on timeout) | Durable promise (UNVERIFIED) | `suspend`/`resume` typed | `waitForTaskToken`, up to 1 yr | External events (UNVERIFIED) | Wait node (webhook/time) |
| Max wait | store-bound | long (limits UNVERIFIED) | not stated | UNVERIFIED | store-bound | 1 year | UNVERIFIED | UNVERIFIED |
| HITL idiom | built-in, typed resume | signals, DIY UI | events, DIY UI | DIY | built-in, typed | token callback, DIY UI | DIY | native-ish forms |
| LLM call = | node function | Activity (recorded) | `step.run` (memoised) | `ctx.run` | step/agent | Lambda/Bedrock task | Activity | AI node |
| Replay / debug | Studio time-travel (UNVERIFIED) | Event history + replayer | Dashboard replay | UI (UNVERIFIED) | Studio | Console graph | Task hub UI | Execution viewer |
| Languages | TS, Python | TS, Go, Java, Python, .NET | TS, Python, Go | TS, Java, Kotlin, Python, Go, Rust, Ruby [S11] | TS | any (ASL + Lambda) | C#, JS/TS, Python, Java, PS [S16] | JSON/visual, JS/Python nodes |
| Managed | LangSmith Deployment [S5] | Temporal Cloud [S8] | Inngest Cloud [S9] | Cloud, BYOC [S11] | Mastra Platform (UNVERIFIED price) | AWS native | Azure native | n8n Cloud (EU) |
| Self-host | Enterprise | Yes (OSS) | Yes (OSS) | Yes | Yes (library) | No | partial | Business/Enterprise |
| Unit cost | LSU compute + $39/seat | $25-50/M Actions | executions, $99/$499 tiers | UNVERIFIED | UNVERIFIED | $0.000025/transition | consumption (UNVERIFIED) | per execution |
| Hook model | graph code | interceptors (UNVERIFIED) | middleware (UNVERIFIED) | UNVERIFIED | workflow code | ASL + Lambda | code | nodes |
| Lock-in | Med | Med | Med | Med | Med-High (young) | High (AWS) | High (Azure) | Med |

## A.3 Grades (three axes)

| Engine | M (maint. load; High = heavy) | C (customer adoption) | A (adaptability) |
|---|---|---|---|
| LangGraph (OSS+Platform) | **Med** — graph is plain code; need Postgres and a deploy target or paid Platform; API churn | **Med** — Python/TS devs know it; customers never see it anyway | **High** — model-agnostic, hooks are just nodes, easy to restructure per team |
| Temporal (Cloud) | **Med** — workers to run + determinism/versioning discipline; service itself managed | **Med** — enterprise buyers know it; extra vendor | **High** — activities swap models/sandboxes freely; interceptors; mature replay testing |
| Inngest | **Low-Med** — no worker pool in serverless mode; fewer moving parts | **Med** — SaaS-first; smaller enterprise footprint | **Med-High** — event-driven decoupling suits gates; long agent steps need external callbacks |
| Restate | **Med** — young server to trust; BYOC helps | **Low-Med** — unfamiliar name to Kofile security review | **High** — multi-language SDKs; durable promises fit HITL |
| Mastra | **Low-Med** — one TS runtime, built-in HITL typing | **Med** — TS shop fit; newer vendor | **Med** — good ergonomics, less proven for week-long runs |
| Step Functions | **Low** on AWS (fully managed, no workers) | **Med** — only if customer teams are AWS; ASL unfamiliar | **Low-Med** — definitions rigid; cross-cloud unfriendly |
| Azure Durable Fn | **Low-Med** on Azure | **Med** — Azure-only | **Med** — code-first, TS supported [S16] |
| n8n as glue only | **Low** — keeps the existing system and owner | **High** — already deployed, visual | **Med** — fine for triggers/notifications, weak for policy and tests |
| n8n as the engine | **Med-High** — Cloud limits push to self-host; JSON workflows; sandbox must be external anyway | **High** | **Low-Med** — graph-in-stage and per-team policy become sprawl |

## A.4 How each would model our draft stage shapes (short)

- **Typed-function stages** (triage, repo-route, merge-verdict, pr-review): one durable step/activity that calls the model with a
  JSON schema, validates in code, retries on schema failure up to N, then **fails closed** (route to a human gate). Temporal: Activity with retry policy;
  Inngest/Restate: `step.run`/`ctx.run`; LangGraph/Mastra: node + conditional edge; Step Functions: Lambda + Choice + Catch.
  Unit-testable with golden inputs in every engine (it is just a function). Engines add nothing special; the contract belongs in a shared library.
- **One-shot generation with human loop** (design, plan, qa-plan): step generates, publishes to Confluence (idempotent by exact page title,
  per the existing repo rule), then waits for approval. Temporal: Signal with a loop in workflow code; Inngest: `waitForEvent` in a loop; LangGraph: `interrupt` in a review node and a back-edge to "redesign"
  (docs advise one `interrupt` per node invocation, looping via edges [S3]); Mastra: `suspend` with typed `resumeSchema`; Step Functions: `.waitForTaskToken` + Choice back to the generate state.
  Gate policy as data = a per-team record `{stage: auto|human|skip}` read at the start of the step.
- **Pure code** (open-pr): an ordinary step; idempotency key = ticket+repo+head-branch (adopt an existing PR).
- **Agentic stages** (execute, fixers): a step that (1) provisions a sandbox, (2) starts the harness with budget/time limits, (3) waits via long activity with heartbeat, or callback event/token, (4) validates post-conditions in code
  (tests green, diff scope, no secrets) and (5) tears down. The engine owns retries and the human escalation when budgets are hit; the harness owns the inner loop.
  Idempotency: the branch name is deterministic; a re-run adopts the branch and compares head SHA.
- **Per-team gate policy and "custom gate/step" hook:** easiest where the graph is code (LangGraph, Temporal, Inngest, Mastra: register a function in a plugin registry that the stage loader consults) and where definitions are data (Step Functions: add a state generated from team config). None of the engines ships a "policy" concept; this layer is ours regardless of engine.

## A.5 Part A: how each fits our requirements (read, not a verdict)

| Requirement | Strongest fit | Notes |
|---|---|---|
| Pause for days across restarts | all except in-memory configs | LangGraph/Mastra need a durable store configured; Temporal/Restate/Inngest/Step Functions include it |
| TypeScript preferred | Temporal, Inngest, Mastra, Restate, LangGraph JS | Step Functions is language-neutral at the edges; ASL is the "language" |
| Managed over self-hosted | Temporal Cloud, Inngest, Step Functions, Durable Fn | LangGraph Platform managed but priced per seat + LSU |
| AWS/Azure agreements | Step Functions (AWS), Durable Fn (Azure) | Temporal/Restate BYOC/workers run on either cloud's compute |
| Model-agnostic | every code-first engine | Step Functions only if you avoid Bedrock-only integrations |
| Company-wide scale | Temporal, Step Functions highest evidence | multi-tenancy = namespaces (Temporal) / separate accounts (AWS) / thread-id scoping (LangGraph) — UNVERIFIED per engine |
| Don't write a harness | all | engines do not touch the harness |
| Fair to n8n | n8n as glue in front of any of them | engine choice does not displace n8n triggers |

---

# PART B — Execute-node hosting (sandbox + coding harness behind one interface)

## B.1 Proposed one-interface contract (what the engine needs from any host)
`start(run_spec) -> run_id` (idempotent on a key) · `status(run_id)` or callback · `events(run_id)` stream (for observability) ·
`cancel(run_id)` · `result(run_id) -> {exit, commit_sha, summary, usage{tokens,cost}, duration}` · hard limits (wall time, token/cost budget, network allowlist).
This keeps "build vs wrap" honest: we write only a thin adapter per host + harness.

## B.2 Harnesses

| Harness | Headless start | Structured output / telemetry | Models | Hooks/extension | Notes |
|---|---|---|---|---|---|
| **Claude Code CLI / Claude Agent SDK** (TS, Python) | `claude -p "..."`; `--bare` for reproducible CI runs; `--allowedTools`, `--permission-mode`, `--permission-prompts none` for unattended [S18] | `--output-format json` returns `total_cost_usd`, per-model cost, usage; `stream-json` events incl. retries and permission denials; `--json-schema` -> `structured_output`; `--max-budget-usd` cap [S18][S19] | Anthropic API, Bedrock, Vertex, Foundry via env; other models through an Anthropic-compatible gateway but **"optimized for Anthropic models"** (OpenRouter docs) [vault: Claude-Code-on-Other-Models] | Hooks, skills, plugins, MCP, subagents; the existing plugin runs as-is with `--plugin-dir` [S18] | Cost fields are **client-side estimates**, not billing [S19]. `AskUserQuestion` removed under `--permission-prompts none` [S18] — the plugin's human gates need remapping. Exits 143 on SIGTERM without a result [S18]. Agent SDK mismatch: per-step `output_tokens` is a placeholder; read result message [S19]. |
| **OpenCode** | Open-source terminal/desktop/IDE agent; "any LLM provider" via keys [S20]. Headless `run` / `serve` and an SDK: nav links exist, content **UNVERIFIED** | Telemetry fields **UNVERIFIED** | Any provider (model-agnostic by design) [S20] | Docs list Plugins/Config/Server/SDK pages — contents **UNVERIFIED** | Reads `AGENTS.md`; v1/v2 binaries share the `opencode` name and can conflict [S20] |
| **Codex CLI** | `codex exec` for pipelines [S21] | JSON events / token usage: **UNVERIFIED** (not on fetched page) | OpenAI-first; other providers **UNVERIFIED** | Sandboxing and permissions profiles; SDK page exists [S21] | Apache-2.0, repo `openai/codex` [S22] |
| **goose** (Block; now under the Linux Foundation's AAIF) | CLI + embeddable API; `goose run`/headless **UNVERIFIED** | **UNVERIFIED** | 15+ providers incl. Anthropic, OpenAI, Google, Ollama, OpenRouter, Azure, Bedrock [S23] | 70+ extensions via MCP [S23] | Apache-2.0, Rust [S23] |
| **OpenHands** | `openhands --headless -t "..."`, `--json` JSONL events; headless is **always-approve** [S24] | action/observation events; token/cost metrics **UNVERIFIED** | Any (BYOK), per vault [vault: Hosted-Coding-Agents] | Reads `AGENTS.md`, `.agents/skills` (vault) | **The CLI "is no longer actively maintained"**; the docs point to "Agent Canvas" [S24] — verify the current headless story before depending on it |
| GitHub Copilot cloud agent / Cursor / Jules / Devin | HTTP APIs | vendor dashboards | multi-vendor / vendor-managed | closed | Hosted products rather than harnesses: no Azure DevOps documented, vendor-owned loop [vault: Hosted-Coding-Agents] |

Harness choice and **model-agnosticism**: the lowest-risk path to "model-agnostic over time" is *not* swapping the model under Claude Code; it is keeping the harness behind the interface so a second harness (OpenCode/goose/Codex) can be benchmarked on the same task. Cost of that optionality: each harness needs its own adapter, prompts and telemetry mapping.

## B.3 Hosts

| Host | Start / observe from an engine | Cold start | Max duration | Git / ADO access | Secrets | Cost model | Telemetry | Model-agnostic? |
|---|---|---|---|---|---|---|---|---|
| **AWS ECS/Fargate** (RunTask) | SigV4 `RunTask`; Step Functions `.sync` / `.waitForTaskToken` native [S15]; poll `DescribeTasks`; self-callback | tens of seconds (UNVERIFIED) | no RunTask timeout; Batch-on-Fargate ≤14 d [vault: Container-Executors] | clone anything over HTTPS with a token; **you** provide git | Secrets Manager/task role; egress proxy for credential injection recommended by Anthropic [S1] | ~$0.040 per 2 vCPU/4 GB x 30 min (ARM) [vault: Cost-Inputs] | CloudWatch logs + your harness output | Yes (your container) |
| **Azure Container Apps Jobs** | ARM `POST .../jobs/<job>/start` with Entra bearer token; can override command/image/env per execution [S25]; poll execution list | UNVERIFIED | `replicaTimeout`; platform maintenance may interrupt long replicas — set `replicaRetryLimit` ≥1 and design for at-least-once [S25] | same as above; ADO PAT or service principal | Job secrets; **permission to start a job can expose its secrets** [S25] | ~$0.108 per 30 min 2 vCPU/4 GB (vault) | Log Analytics; history only the last 100 runs for scheduled/event jobs [S25] | Yes |
| **AWS Bedrock AgentCore Runtime** | `InvokeAgentRuntime` (HTTP/WebSocket); async patterns with `/ping` HealthyBusy; Step Functions integration is **request-response only** [S6][S15] | microVM "starts instantly"; V2 starts from a snapshot [S6] | **8 h** microVM, **14 days** on Instances [S6] | runtime has outbound OAuth for GitHub etc.; no ADO connector documented — UNVERIFIED | AgentCore Identity (Entra, Okta, Cognito) [S6] | consumption: $0.1276/vCPU-h, $0.0169/GB-h, CPU not billed during I/O wait (vault; S6 corroborates model) | built-in agent tracing, reasoning/tool/model events [S6] | Yes, "any model" [S6]; a Claude Code sample exists (vault) |
| **Claude Managed Agents** | REST `POST /v1/sessions`; SSE/poll/signed webhook (webhook carries only type+id; "not a durable log") (vault) | UNVERIFIED | no autonomous runtime limit (first party); 6 h on Claude Platform on AWS (vault) | **GitHub repo resource only; no ADO type** (vault) | Vaults inject at egress; agent never sees value (vault) | tokens at normal rates + **$0.08/session-hour** of `running` time; no Batch discount [S26] | events carry usage; per-session `budget.max_list_cost` (vault) | **Claude-only** — model list is Claude models [S27]. **Beta**, not ZDR/HIPAA eligible [S27] |
| **E2B** | SDK/API; official `claude` template; signed lifecycle webhooks (vault) | sub-second claims are vendor marketing — UNVERIFIED | 1 h Hobby, 24 h Pro [S28] | token-based clone; ADO via HTTPS PAT you inject | env injection; BYOC on Enterprise | $0.000014/vCPU-s + $0.0000045/GiB-s (~$0.17/h default 2 vCPU/4 GiB); Pro $150/mo, Enterprise ≥ $3,000/mo [S28] | sandbox metrics/log stream (UNVERIFIED) | Yes |
| **Daytona** | REST `POST /api/sandbox` (vault) | page claims "sub 90ms creation" — vendor claim, UNVERIFIED [S29] | auto-stop default 15 min; can disable (vault) | same | env | $0.0504/vCPU-h, $0.0162/GiB-h, per-second; $200 free credits [S29] | UNVERIFIED | Yes |
| **Modal** | SDKs only (no REST create on the guide page) (vault) | UNVERIFIED | up to 24 h (vault) | same | Modal secrets | ~$0.119 per 30 min (vault) | UNVERIFIED | Yes |
| **GitHub Actions** | `workflow_dispatch` REST (≤25 inputs), poll run status (vault) | runner queue time (UNVERIFIED) | 6 h/job hosted (vault) | native GitHub; ADO needs PAT | repo/org secrets, OIDC | $0.18-0.36 per 30 min 2/4-core (vault) | job logs; **no token telemetry unless harness writes it** | Yes |
| **Azure Pipelines** | REST queue run (vault) | agent allocation (UNVERIFIED) | UNVERIFIED | native ADO | variable groups / Key Vault | $40 per parallel job/month (vault) | same | Yes |

Vault rows labelled "(vault)" were not re-fetched on 2026-11-04. Re-verify before quoting externally.

## B.4 Part B grades and fit read

| Approach | M | C | A | One-line reason |
|---|---|---|---|---|
| Plain containers on ECS/Fargate or ACA Jobs + Claude Code/Agent SDK | **Med** | **Med-High** | **High** | We own the image, git creds and adapter; no vendor ceiling; reuses plugin skills; works for GitHub and ADO; most plumbing is ours |
| AgentCore Runtime (+ Claude Code/other harness) | **Med** | **Med** | **High** | Managed isolation, identity, tracing on the AWS agreement; AWS-shaped, Azure customers second-class; Step Functions can't `.sync` it today |
| Claude Managed Agents | **Low** | **Low-Med** | **Low** | Least to build and a first-class event stream, but GitHub-only repos, Claude-only, beta, not ZDR/HIPAA — blocks ADO and model-agnostic requirements today |
| E2B / Daytona / Modal sandboxes | **Low-Med** | **Med** | **High** | Fast, purpose-built, BYOC on enterprise; new vendor to approve; we still write the harness adapter |
| GitHub Actions / Azure Pipelines | **Low** | **High** | **Med** | Customers already trust their CI and secrets; poor token telemetry and queueing; ties the engine to per-team CI configuration |
| Hosted coding agents (Copilot, Devin, etc.) | **Low** | **Med** | **Low** | No harness to run, but we lose control of the loop, budgets and telemetry — the benchmark could not be apples-to-apples |

How each fits: ADO repos rule out Managed Agents' repo resource and most hosted agents as the *only* path; plain containers, AgentCore, sandboxes and CI all work with a token you inject. "Don't write a harness" is satisfied by every row (all wrap an existing harness); the work that remains is the adapter + budgets + post-condition checks + egress/credential policy.

---

# Unknowns that need a hands-on spike

What can only be learned by building (ordered by decision leverage). Top 3 get a one-day spike.

1. **Does the existing plugin (or a slimmed prompt set) run unattended under `claude -p` in a container, and what do its human gates become?**
   Spike (1 day): Build a Docker image with Claude Code + `--bare` + `--plugin-dir`, run the `execute` stage on one sample ticket against a scratch GitHub repo and a scratch ADO repo inside a container (Fargate or ACA Job). Capture: wall time, `total_cost_usd`, `modelUsage`, exit status, and what `--permission-prompts none` does to the AskUserQuestion points (vault flags this gap).
   Pass criteria: a green PR on both git hosts from one command, with cost+time JSON saved.
2. **Which engine's pause/resume and idempotency semantics survive our real failure cases (worker restart mid-LLM-call, double webhook, human answers after 3 days)?**
   Spike (1 day): implement the same 4-step slice (triage typed-function -> design generate -> human approve -> container call stub) in the two leading candidates (suggested: Temporal TS and LangGraph JS+Postgres; add Inngest if time) and kill the worker mid-run, deliver the approval twice, and restart after a delay. Record lines of code, what breaks, and how replays are observed.
3. **Can the engine start and observe the execute host with a callback, and how reliable is completion signalling?**
   Spike (1 day): the same container image driven three ways — (a) ECS/ACA Job with poll, (b) callback webhook posted by the container to the engine (event/signal/task token), (c) one sandbox vendor (E2B or AgentCore Runtime). Kill the container mid-run; check duplicate/lost callbacks, cancel, and whether a zombie run keeps spending tokens.
4. Does per-team gate policy as data stay simple once "custom gate" plugins exist (versioning, validation, audit)? (design exercise + 0.5 day schema spike)
5. Does n8n-as-glue add or remove latency/failure modes when it only fires the engine and relays notifications? (half-day with the n8n owner)
6. Multi-tenancy path: namespaces vs account-per-tenant vs row-level scoping for each engine (paper study; PoC will not demo).
7. Token telemetry parity across harnesses (Claude Code vs OpenCode/goose/Codex): is per-stage token and cost data comparable enough for the benchmark? (1 day, after spike 1)
8. Model gateway: whether Claude Code on a non-Anthropic model is stable enough for a fixer loop (the vault records that caveats exist; no run evidence).

---

# Telemetry we can get per approach (for the speed / tokens / cost experiment)

| Layer | What you can read | Quality / caveat |
|---|---|---|
| Claude Code `-p --output-format json` / Agent SDK result | `total_cost_usd`, `modelUsage` (per-model in/out/cache read/cache write, `costUSD`), `usage`, session id, subtype (success/error), `permission_denials` (stream-json) | Cost is a **client-side estimate** from a bundled price table; may drift from billing [S19]. `usage` excludes subagents; use `modelUsage` for whole-tree accounting [S19]. Per-step `output_tokens` is a placeholder; read the result message [S19]. Resumed sessions report cumulative totals — don't sum [S19] |
| Claude Code stream-json | step timeline, `api_retry` events (status, delay), tool calls, init (plugins/MCP loaded) [S18] | Good for time-per-step and retry counts |
| Claude Managed Agents | token usage billed at list prices + `running` session-hours ($0.08/h), billable to the millisecond [S26]; per-session budget cap (vault) | Authoritative runtime metering; idle/waiting time is free [S26] |
| AgentCore Runtime | built-in tracing of reasoning, tool and model calls [S6]; consumption (vCPU-h, GB-h) in AWS billing (vault) | Compute is clear; tokens depend on the harness/provider you call |
| ECS/ACA/CI hosts | wall-clock, CPU/memory, exit codes, logs | **No token data** unless the harness emits it — capture the JSON result into the engine's step output |
| Engine layer | Temporal event history timestamps; Inngest/Step Functions step durations; LangGraph/LangSmith traces; n8n execution durations | Gives per-stage *wall time including human wait*: subtract human-wait spans before comparing speed |
| Provider billing (Anthropic Console / Bedrock / Foundry) | authoritative spend | Daily granularity; use as the check against the client-side estimates |

Benchmark hygiene notes: (a) tag every run with `{ticket, stage, engine, host, harness, model}` and write usage to a table, not logs; (b) measure active compute time separately from waiting-on-human time; (c) pin model IDs and record the served model (the repo's own PDLC rules require verification of what served); (d) account failed/retried runs — both the SDK and Managed Agents bill tokens on failure paths [S19]; (e) the incumbent plugin run needs the same JSON cost capture (`claude -p --output-format json`) to be apples-to-apples.

---

# Sources

Fetched 2026-11-04 unless noted. "vault" = local tag `research/vault-v1`, `docs/research/Portable-Agent-Runtime/*` (2026-10-06/07, not re-fetched).

- [S1] Anthropic, Hosting the Agent SDK — https://code.claude.com/docs/en/agent-sdk/hosting (as quoted in vault note Headless-Claude-Code-and-Agent-SDK; not re-fetched)
- [S2] Claude pricing (Sonnet 5 $2/$10, Opus 5 $5/$25 per MTok; Managed Agents section) — https://platform.claude.com/docs/en/about-claude/pricing
- [S3] LangGraph JS interrupts — https://docs.langchain.com/oss/javascript/langgraph/interrupts
- [S4] LangGraph JS persistence / checkpointers — https://docs.langchain.com/oss/javascript/langgraph/persistence
- [S5] LangChain pricing (LangSmith Deployment) — https://www.langchain.com/pricing
- [S6] AWS Bedrock AgentCore Runtime — https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html
- [S7] Temporal TypeScript SDK docs index — https://docs.temporal.io/develop/typescript
- [S8] Temporal pricing — https://temporal.io/pricing
- [S9] Inngest pricing — https://www.inngest.com/pricing
- [S10] Inngest waitForEvent — https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event
- [S11] Restate docs home — https://docs.restate.dev/
- [S12] Mastra suspend and resume — https://mastra.ai/docs/workflows/suspend-and-resume
- [S13] Mastra snapshots — https://mastra.ai/docs/workflows/snapshots
- [S14] Mastra platform pricing (blog, July 2026; figures not retrieved) — https://mastra.ai/blog/mastra-platform-pricing
- [S15] AWS Step Functions service integration patterns — https://docs.aws.amazon.com/step-functions/latest/dg/connect-to-resource.html
- [S16] Azure Durable Functions overview — https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview
- [S17] n8n Wait — https://docs.n8n.io/flow-logic/waiting/
- [S18] Run Claude Code programmatically — https://code.claude.com/docs/en/headless
- [S19] Claude Agent SDK cost tracking — https://code.claude.com/docs/en/agent-sdk/cost-tracking
- [S20] OpenCode docs — https://opencode.ai/docs/
- [S21] Codex CLI docs (redirect from developers.openai.com/codex/cli) — https://learn.chatgpt.com/docs/codex/cli
- [S22] openai/codex repository — https://github.com/openai/codex
- [S23] block/goose repository — https://github.com/block/goose
- [S24] OpenHands headless mode — https://docs.openhands.dev/openhands/usage/cli/headless
- [S25] Azure Container Apps jobs — https://learn.microsoft.com/en-us/azure/container-apps/jobs
- [S26] Claude Managed Agents pricing section — https://platform.claude.com/docs/en/about-claude/pricing (section "Claude Managed Agents pricing")
- [S27] Claude Managed Agents overview (beta, supported models, ZDR/HIPAA not eligible) — https://platform.claude.com/docs/en/managed-agents/overview
- [S28] E2B pricing — https://e2b.dev/pricing
- [S29] Daytona pricing — https://www.daytona.io/pricing
- Vault notes used: Durable-Orchestrators, Container-Executors, Claude-Managed-Agents, Managed-Agent-Runtimes, Hosted-Coding-Agents, Claude-Code-on-Other-Models, Cost-Inputs, n8n-Cloud-Constraints (tag `research/vault-v1`).
- Searches that returned nothing authoritative: Claude Code + Azure DevOps headless clone (only third-party MCP wrapper pages) — ADO access via PAT/service principal is therefore **UNVERIFIED as a documented Claude Code path**; Mastra Cloud price figures.

Not researched this pass (explicit gaps): Azure Logic Apps, Temporal interceptors and Cloud limits, Restate pricing/license, OpenCode/goose/Codex headless output and token fields, Modal/Azure Pipelines/GitHub Actions re-verification, cold-start measurements for any host.
