# Spike 01: can sdlc-pipeline-plugin run headless?

**Not product code.** Throwaway evidence kept for decision D9; see `notes/spike-01-plugin-headless.md`.

`run.sh` runs `claude -p` in `scratch/` with the plugin loaded via `--plugin-dir`, no MCP (`--strict-mcp-config --mcp-config empty-mcp.json`), capped by `--max-turns` and `--max-budget-usd`, and writes output to `raw/`.
`multiturn.py` drives a stream-json multi-turn session; `models.py` summarises model usage from a stream-json output file.
Raw/scratch output is gitignored.
