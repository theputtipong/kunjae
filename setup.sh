#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

ok() { printf '\033[32m✔\033[0m %s\n' "$1"; }
skip() { printf '\033[90m• %s\033[0m\n' "$1"; }
warn() { printf '\033[33m! %s\033[0m\n' "$1"; }
die() { printf '\033[31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

command -v node >/dev/null || die "ต้องติดตั้ง Node.js 22 ขึ้นไป"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || die "ต้องใช้ Node.js 22 ขึ้นไป (ตอนนี้ $(node -v))"
command -v pnpm >/dev/null || { corepack enable pnpm 2>/dev/null || die "ต้องติดตั้ง pnpm (corepack enable pnpm)"; }
command -v openssl >/dev/null || die "ต้องมี openssl"
ok "node $(node -v) · pnpm $(pnpm -v)"

pnpm install --frozen-lockfile
ok "ติดตั้ง dependencies และ git hooks"

copy_example() {
  if [ -f "$2" ]; then skip "$2 มีอยู่แล้ว"; else cp "$1" "$2"; ok "สร้าง $2"; fi
}
copy_example apps/web/.env.example apps/web/.env.local
copy_example apps/extension/.env.example apps/extension/.env

secret() { openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'; }
if [ -f apps/api/.dev.vars ]; then
  skip "apps/api/.dev.vars มีอยู่แล้ว"
else
  (umask 077; {
    printf 'AUTH_PEPPER=%s\n' "$(secret)"
    printf 'TOKEN_SECRET=%s\n' "$(secret)"
    printf 'CHALLENGE_KEY=%s\n' "$(secret)"
    printf 'ALLOWED_ORIGINS=http://127.0.0.1:5173\n'
  } > apps/api/.dev.vars)
  ok "สร้าง apps/api/.dev.vars ด้วยค่าสุ่ม (ใช้ในเครื่องเท่านั้น)"
fi

pnpm --filter @kunjae/api db:migrate:local >/dev/null
ok "ลง migration ให้ D1 ในเครื่อง"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [ -f apps/android/local.properties ]; then
  skip "apps/android/local.properties มีอยู่แล้ว"
elif [ -d "$SDK" ]; then
  printf 'sdk.dir=%s\n' "$SDK" > apps/android/local.properties
  ok "สร้าง apps/android/local.properties"
else
  warn "ไม่พบ Android SDK — ข้ามส่วน Android (ตั้ง ANDROID_HOME แล้วรันใหม่ได้)"
fi

cat <<'EOF'

พร้อมแล้ว
  pnpm --filter @kunjae/api dev     API       http://127.0.0.1:8787
  pnpm --filter @kunjae/web dev     เว็บ      http://127.0.0.1:5173
  pnpm --filter @kunjae/extension dev   ส่วนขยาย
  pnpm android                      Android (emulator หรือมือถือ USB)

build release ของ Android ต้องมีเพิ่มใน apps/android/:
  keystore.properties               storeFile · storePassword · keyAlias · keyPassword
  local.properties                  kunjae.releaseApiBaseUrl=https://…
EOF
