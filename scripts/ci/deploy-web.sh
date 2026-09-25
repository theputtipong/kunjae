#!/usr/bin/env bash
set -euo pipefail

: "${WEB_ORIGIN:?}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${WEB_ORIGIN#https://}"
HOST="${HOST%%/*}"
case "${WEB_ORIGIN}" in https://*) ;; *) echo "WEB_ORIGIN ต้องเป็น https" >&2; exit 1 ;; esac
test -f "${ROOT}/apps/web/dist/index.html" || { echo "ต้อง build apps/web ก่อน" >&2; exit 1; }

CONFIG="${ROOT}/apps/web/.wrangler.deploy.json"
trap 'rm -f "${CONFIG}"' EXIT
node -e '
  const fs = require("fs");
  const base = JSON.parse(fs.readFileSync(process.argv[1], "utf8").replace(/^\s*"\$schema".*\n/m, ""));
  base.routes = [{ pattern: process.argv[2], custom_domain: true }];
  fs.writeFileSync(process.argv[3], JSON.stringify(base, null, 2));
' "${ROOT}/apps/web/wrangler.jsonc" "${HOST}" "${CONFIG}"

"${ROOT}/apps/api/node_modules/.bin/wrangler" deploy --config "${CONFIG}" "$@"
