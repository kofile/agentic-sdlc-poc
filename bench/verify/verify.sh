#!/usr/bin/env bash
# Verifies every buildable ticket's reference.diff + hidden tests.
# See verify.mjs for what each check does. Exits non-zero on any violation.
#
# Usage: ./verify.sh [TICKET_ID ...]   (default: every buildable ticket)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
node verify.mjs "$@"
