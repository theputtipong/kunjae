#!/usr/bin/env bash
set -euo pipefail

PREFIX="$1"
REF="${GITHUB_REF_NAME:-}"
if [[ "${REF}" =~ ^${PREFIX}([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  NAME="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.${BASH_REMATCH[3]}"
  CODE=$((BASH_REMATCH[1] * 1000000 + BASH_REMATCH[2] * 1000 + BASH_REMATCH[3]))
else
  NAME="0.0.${GITHUB_RUN_NUMBER:-0}"
  CODE="${GITHUB_RUN_NUMBER:-1}"
fi
echo "name=${NAME}" >> "${GITHUB_OUTPUT:-/dev/stdout}"
echo "code=${CODE}" >> "${GITHUB_OUTPUT:-/dev/stdout}"
