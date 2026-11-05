#!/usr/bin/env node
// Verifies every buildable ticket's reference diff + hidden tests, per
// notes/02-benchmark-spec.md section 3a's "Known-good reference" checks:
//
//   (a) the visible suite is green on the unmodified base repo
//   (b) the hidden tests FAIL on the unmodified base repo (they test
//       behavior that doesn't exist yet)
//   (c) applying reference.diff makes the visible suite AND the hidden
//       tests pass together
//   (d) the hidden suite is run 5x against the reference to catch flakiness
//
// Works in temp copies under bench/.tmp/verify/ — never touches the real
// bench/orderdesk or bench/orderdesk-web checkouts.
//
// Execution model: strictly SEQUENTIAL. One ticket at a time, one repo leg
// at a time, one `vitest run` subprocess at a time — never more than one
// test runner competing for the machine's CPU at once. This is deliberate:
// this suite is a benchmark fixture, so a flaky verification is worse than
// a slow one. Each repo's own vitest.config.ts additionally pins its pool
// so a single `vitest run` invocation doesn't fan out into its own
// uncontrolled parallelism either (see bench/orderdesk/vitest.config.ts).
//
// On any failing step, the full stdout+stderr of that step is written to
// bench/.tmp/verify-failures/<ticket>-<repo>-<step>.log (nothing is
// silently retried or discarded), and the failing test names (if any) are
// extracted and printed in the final report.
//
// Usage: node verify.mjs [ticketId ...]   (default: every ticket in tickets.json)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCH_ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = path.join(BENCH_ROOT, ".tmp", "verify");
const FAILURES_DIR = path.join(BENCH_ROOT, ".tmp", "verify-failures");

// Generous per-command ceiling: this whole suite normally runs in well
// under a second, so 120s is purely a deadlock/hang backstop, not a
// performance target.
const COMMAND_TIMEOUT_MS = 120_000;

const { tickets } = JSON.parse(fs.readFileSync(path.join(__dirname, "tickets.json"), "utf8"));

const requestedIds = process.argv.slice(2);
const selected = requestedIds.length > 0 ? tickets.filter((t) => requestedIds.includes(t.id)) : tickets;

fs.rmSync(FAILURES_DIR, { recursive: true, force: true });
fs.mkdirSync(FAILURES_DIR, { recursive: true });

function sh(cmd, args, cwd, opts = {}) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: COMMAND_TIMEOUT_MS,
    ...opts,
  });
}

function tryRun(cmd, args, cwd) {
  try {
    const out = sh(cmd, args, cwd);
    return { ok: true, out };
  } catch (err) {
    const timedOut = err.signal === "SIGTERM" && err.killed;
    const out = (err.stdout ?? "") + (err.stderr ?? "") + (timedOut ? "\n[verify.mjs] command timed out\n" : "");
    return { ok: false, out, error: err };
  }
}

/** Writes a failing step's full output to bench/.tmp/verify-failures/ and
 * returns the path, so nothing about a failure is only visible in a
 * terminal that has already scrolled away. */
function captureFailure(ticketId, repo, step, out) {
  const file = path.join(FAILURES_DIR, `${ticketId}-${repo}-${step}.log`);
  fs.writeFileSync(file, out);
  return file;
}

function summarize(vitestOutput) {
  const match = /Tests\s+(\d+) passed/.exec(vitestOutput) || /Tests\s+.*?(\d+) passed/.exec(vitestOutput);
  const failMatch = /(\d+) failed/.exec(vitestOutput);
  return {
    passed: match ? Number(match[1]) : 0,
    failed: failMatch ? Number(failMatch[1]) : 0,
  };
}

/** Pulls the individual failing test names out of vitest's default
 * reporter output (lines like "  × Suite > test name 12ms"), so a failure
 * report names what broke instead of just a pass/fail count. */
function failingTestNames(vitestOutput) {
  const names = [];
  for (const line of vitestOutput.split("\n")) {
    const m = /^\s*×\s+(.+?)\s+\d+ms\s*$/.exec(line) || /^\s*×\s+(.+)$/.exec(line);
    if (m) names.push(m[1].trim());
  }
  return [...new Set(names)];
}

function freshCopy(repoName, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  sh("cp", ["-R", path.join(BENCH_ROOT, repoName), destDir]);
  fs.rmSync(path.join(destDir, "node_modules"), { recursive: true, force: true });
  fs.symlinkSync(path.join(BENCH_ROOT, repoName, "node_modules"), path.join(destDir, "node_modules"));
  sh("git", ["init", "-q"], destDir);
  sh("git", ["add", "-A"], destDir);
  sh("git", ["-c", "user.email=bench@example.com", "-c", "user.name=bench", "commit", "-q", "-m", "base"], destDir);
}

function hiddenTestFiles(hiddenDir) {
  const abs = path.join(BENCH_ROOT, hiddenDir);
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"))
    .map((f) => path.join(abs, f));
}

function copyInto(files, destTestsDir) {
  for (const f of files) {
    fs.copyFileSync(f, path.join(destTestsDir, path.basename(f)));
  }
}

function removeFrom(files, destTestsDir) {
  for (const f of files) {
    fs.rmSync(path.join(destTestsDir, path.basename(f)), { force: true });
  }
}

function checkCanary(files) {
  for (const f of files) {
    const content = fs.readFileSync(f, "utf8");
    if (!content.includes("BENCH-CANARY-7f3a91c2")) {
      return false;
    }
  }
  return true;
}

function verifyRepoLeg(ticketId, entry) {
  const workDir = path.join(TMP_ROOT, `${ticketId}-${entry.repo}`);
  const testsDir = path.join(workDir, "tests");
  const result = { repo: entry.repo, steps: {}, failureLogs: [], failingTests: [] };

  const hiddenFiles = hiddenTestFiles(entry.hidden);
  result.steps.canary = checkCanary(hiddenFiles);

  freshCopy(entry.repo, workDir);

  // (a) visible suite green on base
  const start = Date.now();
  const visibleOnBase = tryRun("npx", ["vitest", "run"], workDir);
  result.steps.visibleOnBase = visibleOnBase.ok;
  result.visibleWallMs = Date.now() - start;
  if (!visibleOnBase.ok) {
    result.failureLogs.push(captureFailure(ticketId, entry.repo, "visible-on-base", visibleOnBase.out));
    result.failingTests.push(...failingTestNames(visibleOnBase.out));
  }

  // (b) hidden tests fail on base
  copyInto(hiddenFiles, testsDir);
  const hiddenOnBase = tryRun(
    "npx",
    ["vitest", "run", ...hiddenFiles.map((f) => `tests/${path.basename(f)}`)],
    workDir,
  );
  result.steps.hiddenFailsOnBase = !hiddenOnBase.ok;
  if (hiddenOnBase.ok) {
    // Unexpected: the hidden tests should NOT pass against the unmodified
    // base — capture this too, since it means the hidden test doesn't
    // actually exercise new behavior.
    result.failureLogs.push(captureFailure(ticketId, entry.repo, "hidden-unexpectedly-passed-on-base", hiddenOnBase.out));
  }
  removeFrom(hiddenFiles, testsDir);

  // (c) apply reference, run visible + hidden together
  const diffPath = path.join(BENCH_ROOT, entry.diff);
  const applyResult = tryRun("git", ["apply", diffPath], workDir);
  result.steps.diffApplies = applyResult.ok;
  if (!applyResult.ok) {
    result.failureLogs.push(captureFailure(ticketId, entry.repo, "diff-apply", applyResult.out));
  }

  copyInto(hiddenFiles, testsDir);
  const combined = tryRun("npx", ["vitest", "run"], workDir);
  result.steps.referencePasses = combined.ok;
  const counts = summarize(combined.out);
  result.testCounts = counts;
  if (!combined.ok) {
    result.failureLogs.push(captureFailure(ticketId, entry.repo, "reference-combined", combined.out));
    result.failingTests.push(...failingTestNames(combined.out));
  }

  // (d) hidden tests run 5x on the reference to expose flakiness.
  // Every repeat's full output is captured on failure (not just the
  // first), since a test that fails on run 3 of 5 but not run 1 is exactly
  // the kind of flake this step exists to catch.
  let flaky = false;
  for (let i = 1; i <= 5; i++) {
    const rep = tryRun("npx", ["vitest", "run", ...hiddenFiles.map((f) => `tests/${path.basename(f)}`)], workDir);
    if (!rep.ok) {
      flaky = true;
      result.failureLogs.push(captureFailure(ticketId, entry.repo, `hidden-x5-rep${i}`, rep.out));
      result.failingTests.push(...failingTestNames(rep.out));
    }
  }
  result.steps.hiddenStableX5 = !flaky;

  result.failingTests = [...new Set(result.failingTests)];

  result.pass =
    result.steps.canary &&
    result.steps.visibleOnBase &&
    result.steps.hiddenFailsOnBase &&
    result.steps.diffApplies &&
    result.steps.referencePasses &&
    result.steps.hiddenStableX5;

  // Keep the work dir around whenever anything failed, so the failure can
  // be reproduced by hand; only clean up on a fully clean pass.
  if (result.pass) {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  return result;
}

const allResults = [];

// Strictly sequential: one ticket, then the next. Never parallelized.
for (const ticket of selected) {
  const legs = [];
  for (const entry of ticket.repos) {
    legs.push(verifyRepoLeg(ticket.id, entry));
  }
  const pass = legs.every((leg) => leg.pass);
  allResults.push({ id: ticket.id, legs, pass });
}

// --- report ---
const lines = [];
lines.push(`Benchmark reference verification — ${new Date().toISOString()}`);
lines.push(`Execution: sequential, one ticket/repo-leg/vitest-process at a time.`);
lines.push("");
lines.push(
  "Ticket | Repo | Canary | Visible/base | Hidden fails/base | Diff applies | Reference passes | Hidden x5 stable | Tests | Result",
);
lines.push(
  "-------|------|--------|--------------|--------------------|--------------|-------------------|-------------------|-------|-------",
);

let anyFail = false;
for (const t of allResults) {
  for (const leg of t.legs) {
    const row = [
      t.id,
      leg.repo,
      leg.steps.canary ? "yes" : "NO",
      leg.steps.visibleOnBase ? "pass" : "FAIL",
      leg.steps.hiddenFailsOnBase ? "fails (ok)" : "FAIL (did not fail)",
      leg.steps.diffApplies ? "clean" : "FAIL",
      leg.steps.referencePasses ? "pass" : "FAIL",
      leg.steps.hiddenStableX5 ? "stable" : "FLAKY",
      leg.testCounts ? `${leg.testCounts.passed}p/${leg.testCounts.failed}f` : "n/a",
      leg.pass ? "PASS" : "FAIL",
    ];
    lines.push(row.join(" | "));
    if (!leg.pass) anyFail = true;
  }
}

lines.push("");
lines.push(`Overall: ${allResults.filter((t) => t.pass).length}/${allResults.length} tickets verified clean.`);

if (anyFail) {
  lines.push("");
  lines.push("Failures (full logs retained under bench/.tmp/verify-failures/):");
  for (const t of allResults) {
    for (const leg of t.legs) {
      if (leg.pass) continue;
      lines.push(`  ${t.id} / ${leg.repo}:`);
      for (const name of leg.failingTests) {
        lines.push(`    - ${name}`);
      }
      for (const logPath of leg.failureLogs) {
        lines.push(`    log: ${path.relative(BENCH_ROOT, logPath)}`);
      }
    }
  }
}

const report = lines.join("\n");
console.log(report);

fs.mkdirSync(path.join(BENCH_ROOT, "verify"), { recursive: true });
fs.writeFileSync(path.join(BENCH_ROOT, "verify", "last-run.txt"), report + "\n");

process.exit(anyFail ? 1 : 0);
