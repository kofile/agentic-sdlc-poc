#!/usr/bin/env bash
# Launcher: reads the G API key from the macOS Keychain into a 0600 temp file, exports the
# file path (never the key) as ANTHROPIC_API_KEY_FILE, runs the command, removes the file.
# No `set -x`, no `exec` (the EXIT trap must run). G_KEY_SERVICE override is for tests only.
set -euo pipefail

SERVICE="${G_KEY_SERVICE:-claude-bench-g-api-key}"
umask 077
f="$(mktemp)"
trap 'rm -f "$f"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! security find-generic-password -a "$USER" -s "$SERVICE" -w > "$f" 2>/dev/null; then
  echo "with-g-key: no Keychain item for service $SERVICE" >&2
  exit 1
fi

export ANTHROPIC_API_KEY_FILE="$f" GRAPH_REASONING=anthropic
"$@"
