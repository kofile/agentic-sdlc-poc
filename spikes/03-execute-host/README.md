# Spike 03: execute host, local Docker baseline with a stub agent

**Not product code.** Throwaway evidence kept for decision D8; see `notes/spike-03-execute-host.md`.

`src/` and `container/` hold the stub-agent host and its image; `tests/` holds `run-all.ts` (tests A-H and S), plus `smoke.ts`, `lib.ts` and `orch-daemon.ts`.
Re-run from this directory with `node --no-warnings tests/run-all.ts` (Node 22, Docker; builds its own image, about 80 s).
Raw/scratch output is gitignored.
