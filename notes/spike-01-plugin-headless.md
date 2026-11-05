# Spike 01: can sdlc-pipeline-plugin run unattended under `claude -p`?

Date 2026-11-05 (re-run after operator re-login). CLI `claude` 2.1.312, login claude.ai. Plugin loaded from `ai-coe-plugins/plugins/sdlc-pipeline-plugin` (manifest 0.9.2) via `--plugin-dir`. Every run used `--strict-mcp-config --mcp-config empty-mcp.json`, `--max-turns`, `--max-budget-usd`, prompts forbidding Atlassian/GitHub/MCP calls, and the scratch repo; nothing external was touched, nothing committed or pushed. Total spend about $1.6 (sum of result `total_cost_usd`). Raw outputs: `spikes/01-plugin-headless/raw/` (names below). Helpers: `run.sh`, `multiturn.py`, `models.py`.

Note: a first pass earlier today was blocked by an expired CLI login (`Failed to authenticate: OAuth session expired`, exit 1; kept as `raw/r1-authfail.stream.jsonl`, `r2-cleanenv.stream.jsonl`). Auth failure shows `is_error:true` but `subtype:"success"`, `terminal_reason:"api_error"`.

## Verdict table

| Q | Verdict |
|---|---|
| 1 Plugin/skill load + headless skill invoke | Works |
| 2 Ask points (AskUserQuestion) | Works with caveats (no tool; model asks in text and ends turn; pre-answer and stream-json multi-turn both work) |
| 3 Subagent dispatch | Works (parallel confirmed); telemetry caveat: `usage` block undercounts vs `modelUsage` |
| 4 Telemetry | Works with caveats |
| 5 Model pin override | Works with caveats (needs `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`; plain env var does NOT override) |
| 6 Process behaviour | Works (exit codes, kill, resume verified) |
| 7 Container/auth | Documented; unverified live; credential-sensitive |

## Q1. Load and headless skill invocation: WORKS

Init event (`raw/r1-init-event.redacted.json`): `plugins[]` has `sdlc-pipeline-plugin` (source `@inline`, version 0.9.2); `skills[]` has all 28 as `sdlc-pipeline-plugin:*`; `agents[]` all 16; `slash_commands` incl. `:spec-wiki`, `:spec-wiki-refresh`. Docs add `plugin_errors[]` in init for `--plugin-dir` load failures (use as CI gate). The operator's user-level plugins (15 total) also load unless isolated; per docs `--bare` skips them but also skips OAuth/keychain (needs `ANTHROPIC_API_KEY`) and still honours `--plugin-dir`; not tested.

Live run t1 (`raw/t1.out`):
```
./run.sh t1 json --model sonnet "Invoke the Skill sdlc-pipeline-plugin:pipeline-conventions, then in one sentence name the Jira status vocabulary's first status. <no-external-calls>"
```
Result: exit 0, answer "Backlog ... ladder Backlog -> Ready for Dev -> Planning -> In Progress -> Validation -> Ready for PR -> Merge Check -> Deploying -> Done" (matches the skill). `num_turns 3`, `total_cost_usd 0.188`, `terminal_reason completed`. Context cost is high even for trivial prompts (~113k cached tokens in: system prompt + skill listings + user plugins).

## Q2. Ask points: WORKS WITH CAVEATS

- Static: `AskUserQuestion` is in allowed-tools of run-pipeline, pipeline-init, confluence-wiki-generate, repo-wiki-generate, spec-wiki-refresh, test-authoring, integration-tests, e2e-tests, commands spec-wiki/spec-wiki-refresh. Prose "stop and ask" appears in about 16 skills (design 6, plan 6, execute 5, ...).
- Verified: `AskUserQuestion` is NOT in the `-p` tool list. Docs: `--permission-prompts none` removes it explicitly, and `dontAsk` denies it.
- Run a1 (`raw/a1.out`): prompt asked run-pipeline's "resume question". The model called `Skill`, then `ToolSearch select:AskUserQuestion` (not found), then wrote "I couldn't call AskUserQuestion here ... I've written the resume question below as plain text" and ended the turn. Exit 0, `terminal_reason completed`, `permission_denials []`. So: it does not hang or error; it asks in text and the run ends (a harness must detect this, since the result looks like a success).
- Pre-answer in prompt (a2): "operator's pre-answer: resume after the highest completed stage; never ask" -> model applied option 1 and stated it. Works.
- Multi-turn `--input-format stream-json` (`multiturn.py`, `raw/m1.out`): sent turn 1, waited for the `result` event, sent turn 2 as `{"type":"user","message":{"role":"user","content":"Answer: ..."}}` on stdin, closed stdin. Got two `result` events (turn 2 `num_turns 1`, cost cumulative 0.1367 -> 0.1446), exit 0. Works; this is the answer-injection path for a harness. `--permission-prompt-tool` was not tested (it answers permission prompts, not AskUserQuestion).
- Caveat: the model's text question has no machine-readable structure; the harness needs a rule (pre-answer map keyed by stage/question, or detect-and-reply).

## Q3. Subagent dispatch: WORKS

Run d1 (`raw/d1.out`): one message asked for repo-router (sonnet pin) and spec-wiki-fetcher (haiku pin). Both `Agent` tool_use blocks came in the same assistant message (parallel), both `task_started` events appeared before either completed.
- Result: `subagent_stats {spawned 2, requested.foreground 2, max_depth 1, completed 2, failed 0, by_type {repo-router 1, spec-wiki-fetcher 1}}`.
- Subagent messages carry `parent_tool_use_id` = the Agent tool_use id and their own `message.model` (sonnet-5-5 for repo-router, haiku-5-5 for the fetcher). Subagents finish via a `SubagentHandback` tool call. Stream also has `task_started/task_progress/task_updated/task_notification` system events with `task_id`, `output_file`.
- Totals: `total_cost_usd 0.1109` equals the sum of `modelUsage` costs (sonnet 0.10954 + haiku 0.00139), so subagent cost IS included. `modelUsage` has both models. BUT the top-level `usage` block (in 4, cache_create 19958, cache_read 70674, out 457) does not match `modelUsage` sums (sonnet+haiku out 1017, cache_creation 26963+8422): `usage` undercounts subagent/second-model tokens. Use `modelUsage` for tokens and cost. Per-message `usage` in streamed assistant events looks like streaming placeholders (output_tokens 16/25), so don't sum them.
- Per-subagent attribution: possible by `parent_tool_use_id` + `message.model` + `task_id`, tokens only approximately (message usage unreliable); `modelUsage` is per model, not per agent. `--forward-subagent-text` flag exists to include subagent text (not tested).

## Q4. Telemetry: WORKS WITH CAVEATS

`--output-format json` result fields (t1): `type, subtype, is_error, result, session_id, uuid, stop_reason, terminal_reason, num_turns, duration_ms, duration_api_ms, ttft_ms, total_cost_usd, usage{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cache_creation{5m,1h}, server_tool_use, service_tier, iterations[], speed, inference_geo, output_tokens_details.thinking_tokens}, modelUsage{<model>:{inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD, contextWindow, maxOutputTokens, thinkingTokens, canonicalModel, provider, costBasis:"list"}}, permission_denials, subagent_stats, safety_stops, fast_mode_state, time_to_request* timing fields`. `stream-json --verbose` additionally gives init event (model, tools, skills, agents, plugins, startup_timing, apiKeySource), per-message events with `message.model`, `parent_tool_use_id`, task_* events, `post_turn_summary`.
- Served model: yes. Init `model` = `claude-sonnet-5-5` for `--model sonnet`; every assistant message has `message.model`; `modelUsage` keys are the served models (`claude-haiku-5-5` shown for the haiku agent). Default (no `--model`) in clean env was `claude-opus-5-5`.
- `costBasis: "list"`: cost is a list-price estimate (docs: client-side estimate, can differ from bill; subscription login means no per-token billing).
- Resumed sessions report cumulative cost (docs and m1).
- Issues: `usage` undercount (Q3); error runs have `subtype:"success"`; a no-op run costs ~$0.14-0.19 because of the large injected context.
- Per-stage attribution: not provided natively. Derive by slicing the stream at `Skill` tool_use ids and `parent_tool_use_id`.

## Q5. Model pin override: WORKS WITH CAVEATS

Plugin pins: opus 4 (contract-reviewer, design-agent, pr-reviewer, qa-plan-agent), sonnet 6, haiku 1 (spec-wiki-fetcher), inherit 5 (plan-agent, pr-fixer, root-cause-fixer, task-executor, validator-fixer). Tests on 2.1.312, served model read from subagent `message.model` (`raw/p1..p5.out`, `models.py`):

| Run | Setup | Agent frontmatter | Served |
|---|---|---|---|
| p1 | `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` | haiku | claude-haiku-5-5 (env LOST) |
| p2 | `CLAUDE_CODE_SUBAGENT_MODEL=haiku` | sonnet | claude-sonnet-5-5 (env LOST) |
| p3 | env=sonnet + call-level `model: haiku` | opus | claude-haiku-5-5 (call param beat frontmatter and env) |
| p4 | env=sonnet + `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` | haiku | claude-sonnet-5-5 (FORCE wins) |
| p5 | env=sonnet + FORCE=1 + call-level `model: haiku` | opus | claude-sonnet-5-5 (FORCE beats call param too) |

So on 2.1.312 precedence is: FORCE env > call-level param > frontmatter pin > plain `CLAUDE_CODE_SUBAGENT_MODEL` (a default only). A pinned-Sonnet plugin variant = `CLAUDE_CODE_SUBAGENT_MODEL=<sonnet id> CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` plus `--model <sonnet id>` for main thread and `inherit` agents. Caveat: FORCE flattens all agents including haiku/opus ones (fine for a uniform-Sonnet variant); `modelUsage` should be checked to prove only Sonnet served. Not tested: ID spelling other than aliases (`sonnet`) and the `[1m]`/proxy forms (this host serves bare aliases).

## Q6. Process behaviour: WORKS

- Exit codes (verified): success 0; `--max-turns 1` with a tool needed -> exit 1, `subtype error_max_turns`, `terminal_reason max_turns`, `is_error true`, result empty, `errors:["Reached maximum number of turns (1)"]`, `num_turns 2` (cost still reported, $0.076); `--max-budget-usd 0.01` -> exit 1, `subtype error_max_budget_usd`, `terminal_reason budget_exhausted` (note: cost overshoots the cap, $0.075 vs 0.01, because the cap is checked after a turn); auth failure exit 1; unknown flag exit 1 (error on stderr); `--resume <unknown id>` exit 1 "No conversation found". Docs: SIGTERM -> exit 143.
- Kill mid-run (k2, `raw/k2.out`): prompt wrote a.txt then ran a 90 s python sleep; `kill -9` of the process tree at 25 s. State left: a.txt present, b.txt absent, no result event in the stream (truncated), no orphan sleep process, scratch git tree shows only the untracked a.txt; session transcript persists under `~/.claude/projects/<cwd-mangled>/<session>.jsonl`. No `.sdlc`/`.claude` folders were created in scratch. (Plugin `.sdlc/*` state not exercised since no stage skill ran.) Note: foreground `sleep` is blocked in this environment (the model moved it to a background task); background tasks keep a `-p` run open until done, with a 10 min default cap (docs).
- Resume (k3): `--resume <killed session id>` worked, same session_id, model read the interrupted history, finished the task (b.txt written), exit 0, cost cumulative. `--continue` also resumed the latest session in cwd. Docs: after SIGTERM the interrupted turn is left as is; `CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1` continues it.

## Q7. Container and auth: DOCUMENTED (official docs fetched now), NOT run

From https://code.claude.com/docs/en/authentication and /headless:
- Subscription login on macOS is in the Keychain (fallback `~/.claude/.credentials.json` mode 0600); Linux/Windows use `.credentials.json` under `~/.claude` or `$CLAUDE_CONFIG_DIR`. A container cannot reuse the macOS keychain item.
- Non-interactive auth options, in the docs' precedence order: cloud provider vars; `ANTHROPIC_AUTH_TOKEN`; `ANTHROPIC_API_KEY` (always used under `-p` when present); `apiKeyHelper`; `CLAUDE_CODE_OAUTH_TOKEN`; profiles; stored `/login`.
- `claude setup-token` mints a one-year OAuth token (browser flow, printed not saved) for CI; set as `CLAUDE_CODE_OAUTH_TOKEN`; "authenticates with your Claude subscription and requires a Pro, Max, Ultra, Team, or Enterprise plan"; model requests only (no Remote Control, no claude.ai connectors; local MCP fine). `--bare` does NOT read `CLAUDE_CODE_OAUTH_TOKEN` or OAuth/keychain (needs API key). Expired login -> each request fails with `Login expired` until re-login; the token env var has no refresh.
- Plugin mounting: `--plugin-dir` accepts a directory or zip; `--plugin-url` also exists. Config dir via `CLAUDE_CONFIG_DIR` (separate login/settings/history per dir).
- Credential-sensitive, operator decision: minting/storing a 1-year token (and where), and whether using a subscription token for benchmark automation is acceptable under terms (not verified; docs only say it is supported for CI/scripts). The alternative is an API key (separate billing). No container was built or tested.
- Also needed for stage skills (not tested): git, python3, jq, Atlassian MCP creds and `gh`/`az` auth; keep these out of the benchmark by stubbing.

## Surprises
1. `AskUserQuestion` does not exist under `-p`; the model degrades to a text question and the run ends "successfully".
2. Plain `CLAUDE_CODE_SUBAGENT_MODEL` does not override frontmatter pins; only `_FORCE` does (and it also beats an explicit call-level `model`).
3. Top-level `usage` undercounts vs `modelUsage`; `total_cost_usd` matches `modelUsage`.
4. `--max-budget-usd` overshoots (checked after the turn).
5. A trivial run costs ~$0.14-0.19 on Sonnet due to ~100k+ tokens of injected context (user plugins and skill listings inflate it; isolation would change baseline cost).
6. Error runs carry misleading `subtype`; use `is_error` + `terminal_reason`.

## Meaning for baseline P
- Headless load, skill invocation, parallel subagents, resume and telemetry all work, so P can be driven by `claude -p` and measured from `modelUsage` + stream.
- Not demonstrated: any real stage (triage ... deploy) executing; all need Atlassian MCP and `gh`, which must be stubbed/mocked, and most stage skills have prose stop-and-ask points. A driver needs the pre-answer-in-prompt or stream-json reply loop plus detection of "turn ended with a question".
- Pinned-Sonnet variant is feasible with `_FORCE`; the unpinned P (opus/sonnet/haiku mix) is the plugin as shipped.
- Isolation (`--bare` needs an API key; otherwise `--setting-sources`) is needed or the baseline cost/behaviour includes the operator's other plugins.

## Open items
- Run one real stage skill (e.g. `triage` or `repo-route`) against a mocked Jira/catalog to see how many ask points fire; measure per-stage cost from the stream.
- Test `--setting-sources`/`--bare` isolation effect on context size and cost; `--forward-subagent-text`; `--permission-prompt-tool`.
- Confirm plugin `.sdlc/` state left after a killed stage run (not exercised).
- Decide container auth method (OAuth token vs API key) and ToS question.
