#!/usr/bin/env bash

set -euo pipefail

if [[ "${1:-}" != "--" ]]; then
  echo "Usage: bash scripts/sites-env.sh -- <command> [args...]" >&2
  exit 64
fi

shift

if [[ $# -eq 0 ]]; then
  echo "No command provided." >&2
  exit 64
fi

exec "$@"
