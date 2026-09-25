#!/usr/bin/env bash
set -euo pipefail

: "${CWS_EXTENSION_ID:?}"
: "${CWS_CLIENT_ID:?}"
: "${CWS_CLIENT_SECRET:?}"
: "${CWS_REFRESH_TOKEN:?}"
: "${ZIP_PATH:?}"
PUBLISH="${CWS_PUBLISH:-false}"

TOKEN=$(curl -fsS https://oauth2.googleapis.com/token \
  -d client_id="${CWS_CLIENT_ID}" \
  -d client_secret="${CWS_CLIENT_SECRET}" \
  -d refresh_token="${CWS_REFRESH_TOKEN}" \
  -d grant_type=refresh_token | jq -r .access_token)
AUTH=(-H "Authorization: Bearer ${TOKEN}" -H "x-goog-api-version: 2")

RESULT=$(curl -fsS -X PUT "https://www.googleapis.com/upload/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}" \
  "${AUTH[@]}" -T "${ZIP_PATH}")
STATE=$(printf '%s' "${RESULT}" | jq -r .uploadState)
[ "${STATE}" = "SUCCESS" ] || { echo "::error::อัปโหลดไม่สำเร็จ: ${RESULT}"; exit 1; }
echo "อัปโหลดขึ้น Chrome Web Store แล้ว"

if [ "${PUBLISH}" = "true" ]; then
  curl -fsS -X POST "https://www.googleapis.com/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}/publish" \
    "${AUTH[@]}" -H "Content-Length: 0" | jq -c .status
  echo "ส่งตรวจเพื่อเผยแพร่แล้ว"
fi
