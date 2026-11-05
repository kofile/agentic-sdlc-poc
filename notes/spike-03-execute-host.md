# Spike 03 — Execute host: local Docker baseline with a stub agent

Date: 2026-11-05. Status: EVIDENCE for choosing an execute host; no host is recommended here.
Code and raw output: `spikes/03-execute-host/` (`src/`, `container/`, `tests/`, `results/run.log`, `results/results.json`).
Re-run: `node --no-warnings tests/run-all.ts` from that directory (Node 22, Docker; builds its own image, ~80 s). Nothing committed or pushed.
Sections of `01-engine-and-execute-host-research.md` are cited as "note-01 §x". Its B.1 contract is the starting point; this spike tests how much of it a plain container host can actually honour.

Scope guard: local Docker 29.5.3 (Docker Desktop VM, 14 CPU / 8 GB), a local bare git repo as the "remote", a **stub** agent (no LLM, no network, no real credentials; the "token" is a random dummy). Receiver bound to 127.0.0.1 only. No cloud resources created.

## 1. Results (tests A-H, plus S for secrets)

Verdicts are mine and strict only about what the stub can show; see section 5 for what they do not prove.

| Test | Verdict | Measured numbers / evidence |
|---|---|---|
| **A** Cold start | PASS | Image cached: `start()` -> first agent event **median 180 ms** (166-274, n=5); the `start()` call alone (`docker run -d`) median 131 ms; in-container clone done at +44 ms. Image deleted and rebuilt (base layers cached): build 544 ms, then first event 228 ms. Forced re-pull (`--no-cache --pull`, apk add git): build 1.85 s, first event 282 ms. **Caveat:** the "re-pull" is a lower bound; Docker reported the base tag already gone and layer content was probably in the local content store, so a true never-seen-image pull over the network was not measured. |
| **B** Cancel mid-run | PASS | B1 stub handles SIGTERM: cancel->stopped **141-163 ms**, exit 143, status `cancelled`. B2 stub ignores SIGTERM: **3.18 s** (my runner's 3 s escalation to SIGKILL). B3 `docker stop -t 1` with an unresponsive stub: **1.12 s**, exit 137, no `result.json` at all (host infers `cancelled` from its own cancel marker). **Workspace left behind: yes in all 3** — the stopped container keeps `/work/repo` (`docker cp` of an edited file works; ~55 changed paths) until `cleanup()`/`docker rm`. **Partial push: none in 3/3** — the runner pushes only after agent exit 0, so a cancel before that cannot leave a branch. Cancel *during* the push itself was not tested. |
| **C** Callback reliability | PASS (with a design consequence) | Receiver killed: orchestrator saw the terminal state by **polling in ~1.0 s**; the container's own bounded retry (4 attempts, 0.5/1/2 s backoff, my code) ended `ECONNREFUSED`. After the receiver came back, **nothing redelivered** — the host has no callback or retry of its own. Orchestrator-driven resend (poll fallback -> `hostSideCallback`) got HTTP 200 `accepted`. C2: receiver back ~0.8 s after the job finished -> container retry succeeded on attempt 3. **Conclusion: a poll fallback is mandatory.** |
| **D** Duplicate / replay / forged | PASS | Wrong secret 401; tampered body with original signature 401; validly-signed timestamp 1 h old 401 (5 min window); unknown job 404; first valid delivery `accepted`; identical re-send `duplicate` (200); conflicting second terminal status (`failed` after `succeeded`) `duplicate`, stored status stays `succeeded`; 4 concurrent identical deliveries -> exactly 1 `accepted`; host resend after the container already delivered -> `duplicate`. Idempotency is a `wx` create of `completions/<jobId>.json` (first writer wins). Note: replay *inside* the window of an already-accepted message is accepted as a duplicate, which is harmless only because the handler is idempotent. |
| **E** Timeout | PASS | E1 in-container watchdog, 5 s budget: terminal after **5.31 s**, status `timed_out`, reason `budget_exceeded:5s`, same reason in the callback payload, partial `usage.json` written (agent got SIGTERM first), nothing pushed. E2 wedged runner (watchdog disabled, stub hangs), budget 4 s + 2 s host grace: killed by the host's `status()` check, `timed_out` / `host_deadline_kill`, **6.06 s** after polling began; usage recovered only from the event stream. The host backstop only fires if something polls (or a reaper runs); the deadline is also a container label so any reaper can enforce it. |
| **F** Orchestrator death | PASS | Orchestrator SIGKILLed with 3 containers started (2 registered, 1 orphaned by a simulated crash before the registry write). All 3 kept running. Short job finished while no orchestrator was alive and its callback was recorded by the (separate) receiver. New process re-attached by job id from disk: status, branch, commit, usage all recovered; the long job was awaited to success ~10 s after the kill. `list()` rebuilt handles from **labels only** (no registry). `reapOrphans(known)` killed the one running orphan and removed it; it had pushed nothing. `start()` with an existing idempotency key returns the existing handle instead of a second container. Side effect worth knowing: `reapOrphans` also removed 8 old exited containers from earlier tests, because "not in the registry" includes finished ones. |
| **G** Concurrency | PASS | N=4: all succeeded, 4/4 distinct branches, per-branch content isolation checked (each branch diff = exactly `NOTES.md` + `src/generated.js` containing its own job id), 4/4 callbacks; `start()` fan-out 179 ms, batch **3.36 s**. N=8: same checks 8/8, fan-out 444 ms, batch **3.68 s** (single job ~2.7 s). No port use (no `-p`), so no port collision is possible here; concurrent pushes to distinct refs of one bare repo worked. Limits: memory 128 MB -> `OOMKilled=true`, last allocation 96 MB, host status `oom_killed`; CPU `--cpus 0.5` busy loop sampled at **50.0 / 50.1 %** (later two samples read 0 after the job ended); pids limit set (not stress-tested). Same-key `start()` twice -> one container. |
| **H** Telemetry on non-success | PASS | After `docker rm -f` of every container (docker logs gone), `result()` still returned events + usage for 9/9 scenarios: agent failure, graceful cancel, SIGKILLed cancel, escalated cancel, in-container timeout, host-killed timeout, OOM, callback-lost, recovered-after-orchestrator-death. `usage.json` exists on graceful paths; after SIGKILL/OOM/host-kill it is absent and usage is taken from the last usage seen in `events.ndjson` (`usageSource: events`, `partial: true`). Durability comes from the runner appending each event to a host-mounted `/out`. |
| **S** Secrets (extra) | PASS | See section 4. |

## 2. The interface as it ended up

Differences from note-01 B.1: `attach(jobId)`, `list()` and `reapOrphans()` were not in B.1 but F cannot work without them; the callback is a spec field and a signed payload, not a method; `result()` is defined for any terminal state, not only success; handles must be serialisable and rebuildable from a job id.

```ts
export type JobState = 'starting' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out' | 'oom_killed' | 'lost';
export const TERMINAL: JobState[] = ['succeeded', 'failed', 'cancelled', 'timed_out', 'oom_killed', 'lost'];

export interface JobSpec {
  /** Same key => same job (start() is idempotent). */
  idempotencyKey: string;
  repo: { url: string; baseRef: string };
  promptFile: string;
  /** Wall-clock budget for the whole job, enforced in-container and again by the host. */
  budgetSeconds: number;
  limits: { memoryMb: number; cpus: number; pids: number };
  testCommand: string;
  /** Completion webhook; secret is per job, generated by the host, never baked into the image. */
  callback?: { url: string; attempts?: number };
  secrets: { jobToken: string; mode?: 'file' | 'env' };
  stub?: Record<string, unknown>;      // test knobs for the stub agent only
  runnerWatchdog?: boolean;
}
export interface JobHandle { jobId: string; backend: string; ref: string; createdAt: number; deadlineAt: number }
export interface JobStatus {
  state: JobState; reason?: string; exitCode?: number; oomKilled?: boolean;
  startedAt?: number; finishedAt?: number;
  /** True when inferred without a runner-written result.json (host-side view only). */
  inferred?: boolean;
}
export interface LogLine { stream: 'stdout' | 'stderr'; text: string; receivedAt: number }
export interface Usage { input_tokens: number; output_tokens: number; total_cost_usd: number; partial?: boolean; [k: string]: unknown }
export interface JobResult {
  status: JobStatus;
  branch?: string; commit?: string;
  patchPath?: string;                  // git format-patch: PR-ready even if the host cannot push
  usage?: Usage; usageSource: 'usage.json' | 'events' | 'none';
  eventsPath: string;
  callback?: { attempted: boolean | string; delivered?: boolean; attempts?: number };
}
export interface CancelResult { requestedAt: number; stoppedAt: number; latencyMs: number; state: JobState }

export interface ExecuteHost {
  start(spec: JobSpec): Promise<JobHandle>;
  status(h: JobHandle): Promise<JobStatus>;
  logs(h: JobHandle, opts?: { follow?: boolean }): AsyncIterable<LogLine>;
  cancel(h: JobHandle, opts?: { graceSeconds?: number }): Promise<CancelResult>;
  /** Valid for any terminal state, including failed/cancelled (telemetry must survive). */
  result(h: JobHandle): Promise<JobResult>;
  /** Re-attach after orchestrator restart: rebuild a handle from the job id alone. */
  attach(jobId: string): Promise<JobHandle | null>;
  /** Everything this host owns (by label), for orphan detection. */
  list(): Promise<Array<{ handle: JobHandle; status: JobStatus }>>;
  /** Kill+remove anything owned by us that is unknown to `known`. */
  reapOrphans(known: Set<string>): Promise<{ killed: string[]; removed: string[] }>;
  cleanup(h: JobHandle): Promise<void>;
}

/** Signed completion callback: headers X-Job-Id, X-Timestamp, X-Signature: sha256=HMAC(secret, `${ts}.${body}`). */
export interface CompletionEvent {
  jobId: string; status: string; reason?: string; branch?: string; commit?: string; exitCode?: number;
  durationMs?: number; usage?: Usage | null; deliveryId: string; emittedAt: string; source: 'container' | 'host';
}
```

Shape of the Docker backend: a thin in-container **runner** (clone, spawn agent, enforce budget, commit, push, write `result.json`, post callback) plus a host class that is only `docker run/stop/inspect/logs` and file reads. Almost every guarantee (budget, retry, telemetry durability, no-partial-push, status classification) is runner code or orchestrator code, not something Docker supplies. That is the part to carry to any other host.

## 3. Surprises

1. **`docker inspect` and the exit code disagree about OOM.** The kernel killed the agent child, the runner survived, reported `agent_killed_SIGKILL`, and the container exited 1 with `OOMKilled=true`. Classifying OOM needs both signals; a runner-only view says "failed".
2. **No terminal record on SIGKILL paths.** When the grace period runs out (B3), the host kills a wedged runner (E2) or the OOM killer takes the runner itself, there is no `result.json`; status is *inferred* from host-side markers (cancel marker, deadline label, `OOMKilled`). Without those markers the same container is just `lost`/`failed`. The orchestrator must write its intent (cancelled, deadline) somewhere durable *before* acting.
3. **Retry is not a host property.** Docker has none, and the container is gone before a late receiver returns. Reliability needs (poll or reconciler) + (idempotent receiver) + (a way to regenerate the signed event host-side).
4. **A callback secret inside the container lets a compromised agent forge "succeeded".** My runner strips secrets from the agent's env, but the files are readable by the same uid (demonstrated). The orchestrator should confirm the claimed commit exists on the remote before trusting `succeeded`; I did not implement that check.
5. **Stopped containers keep the workspace** until removed, so "cancel" and "clean up" are two operations. A tmpfs workspace would vanish on stop but counts against the memory limit, which matters for real `node_modules`.
6. **`reapOrphans` needs a notion of "known" that includes finished jobs**, or it deletes results-in-waiting.
7. **First-event latency is dominated by `docker logs -f` attach (~100 ms), not by the agent.** In-container timing (clone at +44 ms) is the cleaner measure.
8. The `host.docker.internal` -> receiver bound to `127.0.0.1` path worked on Docker Desktop. On a Linux engine that traffic arrives on the bridge gateway, not loopback, so the same receiver likely would **not** be reachable (not tested).

## 4. Secrets: where the dummy token is and is not visible

Per-job `job_token` and `callback_secret` are generated at `start()`, written `0600` under the job's state dir, and bind-mounted read-only at `/run/secrets` (file mode). `env` mode passes `JOB_TOKEN` via `docker run -e`.

| Location | File mode | Env mode |
|---|---|---|
| Image layers / `docker history --no-trunc` / `docker inspect <image>` | not visible | not visible |
| `docker inspect <container>` | not visible (only the mount path) | **VISIBLE** (`Config.Env`) |
| `docker logs`, `events.ndjson`, `/out` | not visible (runner logs token *length* only) | not visible |
| Inside the container | readable by any process with the same uid (`cat /run/secrets/job_token` works); stripped from the agent child's env | in PID 1 `/proc/1/environ` |
| Host disk | `<state>/jobs/<id>/secrets/*`, mode 0600, removed by `cleanup()` | n/a |
| Anyone with Docker socket access | can read both | can read both |

So: never baked into the image (confirmed), not in logs (confirmed, only because the runner never prints it), file mount avoids `docker inspect` exposure but not same-uid reads. A real agent runs arbitrary shell commands, so "readable by the agent" is the default; scoping the token (per-repo, short TTL) matters more than where it is mounted.

## 5. Limits of a stub: what a real coding agent would change

- **Duration and volume.** Stub jobs last 1-15 s with a few KB of events. Real runs last minutes to hours with large stream-json output; log retention, size caps and backpressure were not exercised. Callback retry window (3.5 s here) would have to be far longer, or replaced by a reconciler.
- **Cancel semantics.** Per note-01 B.2/[S18], Claude Code exits 143 on SIGTERM **without a result message**, so the clean `usage.json`-on-SIGTERM path (B1) will not exist; real cancel behaves like B3/H: usage only from the event stream (`usageSource: events`). The fallback was built for this, but token counts in a truncated stream-json are an unvalidated approximation (cost is a client-side estimate per [S19]).
- **Process trees.** The stub is one child. Real agents spawn shells, test runners and servers; cancel needs process-group kill, and orphans inside the container must not survive `stop`. Not tested.
- **Resources.** The stub uses ~40 MB. A real agent plus `npm install`/test suites needs far more memory, disk and pids; OOM would more often hit a child than the runner, so surprise 1 becomes the common case. Disk quota was not tested.
- **Network.** The stub needs no model API and no egress policy. A real run needs an allowlisted route to the model endpoint and git host (note-01 [S1] recommends an egress proxy for credential injection); none of that was exercised.
- **Git auth.** A local `file://` bare repo mounted read-write gives the job write access to every ref. A real token should be scoped; push failure modes (auth, protected branches, non-fast-forward, "nothing to commit") were barely touched.
- **Non-determinism.** The stub always produces a diff and passes its test. Real agents sometimes produce no diff, fail tests, or loop until the budget.
- **Cold start.** 180 ms is container start with a 50 MB image on a warm local daemon. Real numbers include a multi-hundred-MB image with Claude Code, a real clone, and cloud scheduling (note-01 B.3 marks Fargate tens of seconds as UNVERIFIED).

## 6. Not tested

Any cloud host; Linux Docker engine behaviour (loopback receiver reachability, cgroup v1/v2 differences); rootless Docker; Docker daemon restart or host reboot mid-job; cancel racing the push; a stronger sandbox (gVisor/Firecracker-class); private-registry pulls and a true cold network pull; TLS on the callback; pids-limit stress; disk limits; multi-host scheduling; log size/rotation; real model egress.

## 7. Mapping: how each interface operation would map to the four cloud hosts

Basis is note-01 B.3 (host table), B.1 (contract), "Unknowns" #3, and its telemetry table; I do not repeat their numbers. Where I add a claim that note-01 does not contain, it is tagged **(general knowledge, unverified)** and must be checked against current docs before use. "Our runner" means the container-side logic proved in this spike.

| Operation | AWS ECS Fargate | Azure Container Apps jobs | Bedrock AgentCore Runtime | Claude Managed Agents |
|---|---|---|---|---|
| **start** | `RunTask` (SigV4); note-01 B.3 lists Step Functions `.sync`/task-token as native. Idempotency token on RunTask **unknown** (general knowledge: a `clientToken` parameter may exist, verify). Start-time per-run env/command overrides: supported. | `POST .../jobs/<job>/start` with per-execution command/image/env overrides [S25]. Idempotency of start: **unknown**. | `InvokeAgentRuntime` (HTTP/WebSocket); long work is the async pattern with `/ping` HealthyBusy [S6]; our runner would be the "agent". How a session id maps to run identity/idempotency: **unknown**. | `POST /v1/sessions` (note-01 B.3, vault). Idempotency: **unknown**. There is no clone-and-run-our-runner: the harness is theirs, so the spike's runner does not apply. |
| **status** | `DescribeTasks` (`lastStatus`, `stopCode`, exit code); push via task-state events is **unknown** here. Task disappears from the API after ~1 h (general knowledge, unverified), so results must not live in the task. | Execution list/get; note-01 says history is only the last 100 runs for scheduled/event jobs [S25]. Whether manual-trigger history has the same cap: **unknown**. | `/ping` HealthyBusy is a liveness hint, not a job status; a real "done/failed" status would have to be written by our runner to our store. Native status API for a long async invocation: **unknown**. | Session status plus event stream; exact status vocabulary: **unknown** (not fetched). |
| **logs** | CloudWatch Logs; our runner's stdout works as-is. Tail latency: **unknown**. | Log Analytics (note-01 B.3); ingestion delay and live-tail: **unknown**. | Built-in tracing of reasoning/tool/model events [S6]; raw container stdout availability: **unknown**. | First-class SSE event stream (note-01 B.3); retrievable after the session ends: **unknown**. |
| **cancel** | `StopTask` -> SIGTERM then SIGKILL after the container stop timeout (value and cap: **unknown**; this spike showed the timeout path loses `result.json`). | Stopping a running execution: API existence and grace semantics **unknown**. [S25] warns of platform interruption and recommends at-least-once design. | Ending a session/microVM: API and signal behaviour **unknown**. | Interrupt/delete session: **unknown**. |
| **callback** | None native. Options: our runner posts (as here); EventBridge task-state-change -> webhook/queue (**unknown**); Step Functions task token (note-01 B.3, A.4). | None native documented in note-01; runner posts; Event Grid/other: **unknown**. | None; Step Functions integration is request-response only (note-01 B.3, B.4), so no `.sync`. Runner posts. | Signed webhook carrying only type+id, "not a durable log" (note-01 B.3, vault) -> receiver must fetch details; signature scheme and retry policy: **unknown**. |
| **result retrieval** | No shared mount like `/out`: need S3/EFS or a push. Branch push works with a token we inject (note-01 B.3). | Same: Azure Files/Blob or push; ADO via PAT/service principal (note-01 B.3, flagged UNVERIFIED as a documented Claude Code path). | Runner pushes/uploads; session storage persistence across the 8 h lifetime: **unknown**. | GitHub repo resource only, **no ADO type** (note-01 B.3); PR/branch hand-back mechanism and artifact retrieval: **unknown**. |
| **timeout** | No RunTask timeout (note-01 B.3) -> runner watchdog + orchestrator `StopTask` (E1/E2 pattern applies directly). | `replicaTimeout`; replica retry can re-run a job (`replicaRetryLimit` >=1 advised) [S25] -> duplicate-execution risk; our branch naming and idempotent receiver are what contain it. | 8 h microVM / 14 d on Instances [S6]; idle timeout config: **unknown**. | No autonomous runtime limit on first party (note-01 B.3); budget cap per session (`budget.max_list_cost`, vault) is the cost-shaped timeout. |
| **secrets** | Secrets Manager/task role (note-01 B.3). Whether values appear in task-definition describe output vs env only: **unknown** (this spike's env-mode finding suggests treating injected env as visible to anyone who can inspect the task). | Job secrets; **start permission can expose secrets** [S25] (stronger than the Docker `inspect` finding). | AgentCore Identity [S6]; per-invocation secret injection: **unknown**. | Vaults inject at egress, agent never sees the value (note-01 B.3, vault): the one model where the in-container-readable-secret finding does not apply. |
| **telemetry on failure** | CloudWatch + our runner output; durable events need S3/log shipping (our `/out` bind mount has no equivalent). | Same (Log Analytics). | Built-in tracing [S6]; token usage depends on harness. | Usage in events; billed on failure paths too (note-01 hygiene note d). |

### Credentials/accounts the operator would need to provision to test each for real

Nothing below was used or created in this spike. Cost flags assume the stub-sized test used here.

| Host | What to provision | Cost flag |
|---|---|---|
| **ECS Fargate** | A sandbox AWS account (or isolated OU); an IAM role/user allowed `ecs:RunTask/StopTask/DescribeTasks/ListTasks`, `iam:PassRole`, `logs:GetLogEvents`, ECR push, and optionally `events`/`sqs`/`states` for callback tests; ECR repo; ECS cluster; task definition + execution role; VPC subnets and a security group with outbound access; CloudWatch log group; Secrets Manager secret (dummy token); S3 bucket for results; a git remote reachable from the task (a scratch GitHub repo + fine-scoped token; ADO needs a PAT). | Per-task pennies (note-01 B.3 figure). **Watch:** a NAT gateway (standing hourly + data charge) if tasks run in private subnets — use a public subnet with a public IP for the spike; Secrets Manager charges per secret per month; ECR/CloudWatch storage. |
| **Azure Container Apps jobs** | An Azure subscription + resource group; Container Apps environment; Azure Container Registry (or public image); an Entra app/service principal with rights to create and **start** jobs and read executions; Log Analytics workspace; storage account (Files/Blob) for results; optional Key Vault; git remote token as above. | Per-execution pennies (note-01 B.3). **Standing costs:** ACR SKU and Log Analytics ingestion/retention. Free-grant coverage of job seconds: **unknown**. |
| **Bedrock AgentCore Runtime** | An AWS account with AgentCore available in the chosen region and any required Bedrock access request; IAM for creating/invoking/stopping runtimes; ECR image (architecture requirement: **unknown**, verify); CloudWatch/observability enablement; AgentCore Identity setup only if outbound OAuth is under test. | Consumption billing by vCPU-h/GB-h (note-01 B.3). A **stub** costs pennies; a **real harness** would also call a model, which is token cost (note-01 §0 finding 3). Whether a minimum or idle charge applies: **unknown**. |
| **Claude Managed Agents** | An Anthropic organization/workspace with Managed Agents beta access and an API key; a scratch **GitHub** repo with an app/token for the repo resource (ADO cannot be tested here per note-01 B.3); a vault credential if egress injection is under test. | **Cannot be stubbed — the loop is theirs, so every run spends real tokens** plus $0.08 per session-hour [S26]. Use a tiny task and set `budget.max_list_cost`. Beta, not ZDR/HIPAA eligible [S27]: confirm compliance before pointing it at anything but scratch code. |

What the real-host spike (note-01 "Unknowns" #3) should reuse from this one unchanged: the runner, the signed-callback receiver, the poll/reconcile loop, the state/label recovery model, and tests B-H as scripted scenarios against a new `ExecuteHost` implementation.
