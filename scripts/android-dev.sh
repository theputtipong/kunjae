#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/apps/api"
ANDROID_DIR="$ROOT/apps/android"
API_PORT=8787
API_LOG="$API_DIR/.wrangler/android-dev-api.log"
API_PID_FILE="$API_DIR/.wrangler/android-dev-api.pid"
APP_ID="com.kunjae.app"

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

WANT_LOGS=0
case "${1:-}" in
  --logs) WANT_LOGS=1 ;;
  --stop)
    if [[ -f "$API_PID_FILE" ]]; then
      kill "$(cat "$API_PID_FILE")" 2>/dev/null || true
      lsof -ti "tcp:$API_PORT" -sTCP:LISTEN | xargs kill 2>/dev/null || true
      rm -f "$API_PID_FILE"; echo "ปิด API แล้ว"
    else
      echo "ไม่มี API ที่สคริปต์นี้เปิดไว้"
    fi
    exit 0 ;;
  "") ;;
  *) die "ไม่รู้จัก $1 — ใช้ได้แค่ --logs หรือ --stop" ;;
esac

step "ตรวจเครื่องมือ"

command -v node >/dev/null || die "ไม่พบ node — ติดตั้ง Node 22 ก่อน (เช่น nvm install 22)"
command -v pnpm >/dev/null || die "ไม่พบ pnpm — รัน: corepack enable"
ok "node $(node -v) · pnpm $(pnpm -v)"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
[[ -d "$ANDROID_HOME" ]] || die "ไม่พบ Android SDK ที่ $ANDROID_HOME — ติดตั้ง Android Studio แล้วเปิดหนึ่งครั้งให้มันลง SDK"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
[[ -x "$ADB" ]] || die "ไม่พบ adb — ติดตั้ง 'Android SDK Platform-Tools' จาก SDK Manager"
ok "Android SDK: $ANDROID_HOME"

if ! command -v java >/dev/null && [[ -z "${JAVA_HOME:-}" ]]; then
  STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  [[ -d "$STUDIO_JBR" ]] || die "ไม่พบ Java — ติดตั้ง Android Studio หรือ JDK 17 ขึ้นไป"
  export JAVA_HOME="$STUDIO_JBR"
fi
ok "Java พร้อม"

if [[ ! -f "$ANDROID_DIR/local.properties" ]]; then
  echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"
  ok "สร้าง local.properties"
fi

step "เตรียม API"

if [[ ! -d "$ROOT/node_modules" || ! -d "$API_DIR/node_modules" ]]; then
  (cd "$ROOT" && pnpm install)
fi
ok "dependencies ครบ"

if [[ ! -f "$API_DIR/.dev.vars" ]]; then
  secret() { openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'; }
  cat > "$API_DIR/.dev.vars" <<EOF
AUTH_PEPPER=$(secret)
TOKEN_SECRET=$(secret)
CHALLENGE_KEY=$(secret)
ALLOWED_ORIGINS=http://127.0.0.1:5173
EOF
  ok "สร้าง apps/api/.dev.vars ด้วยค่าลับสุ่มสำหรับเครื่องนี้"
else
  ok ".dev.vars มีอยู่แล้ว"
fi

(cd "$API_DIR" && CI=1 pnpm -s db:migrate:local >/dev/null) || die "ลง migration ของ D1 ไม่สำเร็จ — ลองรัน: cd apps/api && pnpm db:migrate:local"
ok "ฐานข้อมูล D1 ในเครื่องเป็นเวอร์ชันล่าสุด"

api_up() { curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; }

if api_up; then
  ok "API รันอยู่แล้วที่ :$API_PORT"
else
  mkdir -p "$(dirname "$API_LOG")"
  (cd "$API_DIR" && nohup pnpm dev --port "$API_PORT" >"$API_LOG" 2>&1 & echo $! >"$API_PID_FILE")
  printf '  รอ API เปิด'
  for _ in $(seq 60); do api_up && break; printf '.'; sleep 1; done
  echo
  api_up || die "API ไม่ขึ้นภายใน 60 วินาที — ดู log: $API_LOG"
  ok "เปิด API แล้ว (log: ${API_LOG#"$ROOT"/})"
fi

step "เลือกเครื่อง"

"$ADB" start-server >/dev/null 2>&1
online_devices() { "$ADB" devices | awk 'NR>1 && $2=="device" {print $1}'; }

if [[ -z "${ANDROID_SERIAL:-}" ]]; then
  ANDROID_SERIAL="$(online_devices | grep -v '^emulator-' | head -1 || true)"
  [[ -n "$ANDROID_SERIAL" ]] || ANDROID_SERIAL="$(online_devices | head -1 || true)"
fi

if [[ -z "$ANDROID_SERIAL" ]]; then
  [[ -x "$EMULATOR" ]] || die "ไม่มีเครื่องต่ออยู่และไม่พบ emulator — ติดตั้ง 'Android Emulator' จาก SDK Manager"
  AVD="${KUNJAE_AVD:-$("$EMULATOR" -list-avds | head -1)}"
  [[ -n "$AVD" ]] || die "ยังไม่มี AVD — สร้างใน Android Studio: Device Manager → Create Virtual Device"
  EMULATOR_FLAGS="${KUNJAE_EMULATOR_FLAGS:--gpu host -no-boot-anim -no-audio}"
  echo "  เปิด emulator: $AVD ($EMULATOR_FLAGS)"
  nohup "$EMULATOR" -avd "$AVD" -no-snapshot-save $EMULATOR_FLAGS >/dev/null 2>&1 &
  JUST_BOOTED=1
  printf '  รอเครื่องบูต'
  BOOTED=0
  for _ in $(seq 180); do
    ANDROID_SERIAL="$(online_devices | grep '^emulator-' | head -1 || true)"
    if [[ -n "$ANDROID_SERIAL" ]] &&
       [[ "$("$ADB" -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      BOOTED=1; break
    fi
    printf '.'; sleep 1
  done
  echo
  [[ $BOOTED == 1 ]] || die "emulator บูตไม่เสร็จภายใน 3 นาที"
fi
export ANDROID_SERIAL
ok "ใช้เครื่อง $ANDROID_SERIAL"

if [[ "$ANDROID_SERIAL" == emulator-* ]]; then
  printf '  รอ package manager'
  for _ in $(seq 120); do
    "$ADB" shell cmd package list packages android >/dev/null 2>&1 && break
    printf '.'; sleep 1
  done
  echo
  if [[ "${JUST_BOOTED:-0}" == 1 ]]; then
    SETTLE="${KUNJAE_BOOT_SETTLE:-15}"
    printf '  รอ System UI นิ่ง %s วินาที' "$SETTLE"
    for _ in $(seq "$SETTLE"); do printf '.'; sleep 1; done
    echo
  fi
  for key in window_animation_scale transition_animation_scale animator_duration_scale; do
    "$ADB" shell settings put global "$key" 0 >/dev/null 2>&1 || true
  done
  ok "เครื่องพร้อม (ปิด animation แล้ว)"
fi

if [[ "$ANDROID_SERIAL" == emulator-* ]]; then
  API_URL="http://10.0.2.2:$API_PORT"
else
  "$ADB" reverse "tcp:$API_PORT" "tcp:$API_PORT" >/dev/null
  API_URL="http://127.0.0.1:$API_PORT"
  ok "adb reverse :$API_PORT → Mac"
fi

step "Build และติดตั้ง (API: $API_URL)"
(cd "$ANDROID_DIR" && ./gradlew :app:installDebug -Pkunjae.apiBaseUrl="$API_URL" --console=plain -q)
ok "ติดตั้งแล้ว"

HOST_RAM_GB=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824 ))
if [[ "${KUNJAE_KEEP_GRADLE:-0}" != 1 && $HOST_RAM_GB -le 8 ]]; then
  (cd "$ANDROID_DIR" && ./gradlew --stop -q >/dev/null 2>&1) || true
  ok "ปิด Gradle daemon เพื่อคืนแรมให้ emulator (แรมเครื่อง ${HOST_RAM_GB}GB)"
fi

"$ADB" shell am start -n "$APP_ID/.MainActivity" >/dev/null
ok "เปิดแอปแล้ว"

printf '\n\033[1;32mพร้อมใช้งาน\033[0m — API ยังรันอยู่เบื้องหลัง ปิดด้วย: pnpm android --stop\n'

if [[ $WANT_LOGS == 1 ]]; then
  step "logcat (Ctrl+C เพื่อออก)"
  PID="$("$ADB" shell pidof "$APP_ID" | tr -d '\r')"
  exec "$ADB" logcat --pid="$PID"
fi
