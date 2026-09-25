#!/usr/bin/env bash
set -euo pipefail

: "${PLAY_SERVICE_ACCOUNT_JSON:?}"
: "${PLAY_PACKAGE_NAME:?}"
: "${AAB_PATH:?}"
TRACK="${PLAY_TRACK:-internal}"
STATUS="${PLAY_RELEASE_STATUS:-draft}"
API="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE_NAME}"
UPLOAD="https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PLAY_PACKAGE_NAME}"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

WORK=$(mktemp -d)
trap 'rm -rf "${WORK}"' EXIT
printf '%s' "${PLAY_SERVICE_ACCOUNT_JSON}" > "${WORK}/sa.json"
jq -r .private_key "${WORK}/sa.json" > "${WORK}/key.pem"
EMAIL=$(jq -r .client_email "${WORK}/sa.json")
NOW=$(date +%s)
HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
CLAIMS=$(jq -cn --arg iss "${EMAIL}" --argjson iat "${NOW}" --argjson exp $((NOW + 3000)) \
  '{iss:$iss,scope:"https://www.googleapis.com/auth/androidpublisher",aud:"https://oauth2.googleapis.com/token",iat:$iat,exp:$exp}' | b64url)
SIGNATURE=$(printf '%s.%s' "${HEADER}" "${CLAIMS}" | openssl dgst -sha256 -sign "${WORK}/key.pem" | b64url)
TOKEN=$(curl -fsS https://oauth2.googleapis.com/token \
  -d grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer \
  -d assertion="${HEADER}.${CLAIMS}.${SIGNATURE}" | jq -r .access_token)
AUTH=(-H "Authorization: Bearer ${TOKEN}")

EDIT=$(curl -fsS -X POST "${API}/edits" "${AUTH[@]}" | jq -r .id)
VERSION_CODE=$(curl -fsS -X POST "${UPLOAD}/edits/${EDIT}/bundles?uploadType=media" "${AUTH[@]}" \
  -H "Content-Type: application/octet-stream" --data-binary "@${AAB_PATH}" | jq -r .versionCode)
jq -cn --arg track "${TRACK}" --arg status "${STATUS}" --arg code "${VERSION_CODE}" --arg notes "${RELEASE_NOTES:-}" \
  '{track:$track,releases:[{versionCodes:[$code],status:$status} + (if $notes == "" then {} else {releaseNotes:[{language:"th-TH",text:$notes}]} end)]}' \
  | curl -fsS -X PUT "${API}/edits/${EDIT}/tracks/${TRACK}" "${AUTH[@]}" -H "Content-Type: application/json" --data-binary @- > /dev/null
curl -fsS -X POST "${API}/edits/${EDIT}:commit" "${AUTH[@]}" > /dev/null
echo "อัปโหลด versionCode ${VERSION_CODE} ขึ้น track ${TRACK} (${STATUS}) แล้ว"
