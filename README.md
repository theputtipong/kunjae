# Kunjae (กุญแจ)

ตัวจัดการรหัสผ่านแบบ **zero-knowledge** สำหรับเว็บ, Android และส่วนขยายเบราว์เซอร์
ข้อมูลทุกอย่างถูกเข้ารหัสในอุปกรณ์ของผู้ใช้ก่อนส่งออกไป เซิร์ฟเวอร์เก็บได้แค่ ciphertext และไม่มีทางถอดรหัสได้

- เว็บแอป: <https://kunjae.pdouvch.com>
- นโยบายความเป็นส่วนตัว: <https://kunjae.pdouvch.com/privacy> · ข้อกำหนดการใช้งาน: <https://kunjae.pdouvch.com/terms>
- ติดต่อเรา: <https://kunjae.pdouvch.com/contact> · ขอลบบัญชี: <https://kunjae.pdouvch.com/delete-account>
- ติดต่อ: support.pdouvch@gmail.com

## สารบัญ

1. [Features](#features)
2. [โมเดลความปลอดภัย](#โมเดลความปลอดภัย)
3. [สถาปัตยกรรม](#สถาปัตยกรรม)
4. [โครงสร้าง repo](#โครงสร้าง-repo)
5. [เริ่มพัฒนา](#เริ่มพัฒนา)
6. [การตั้งค่า](#การตั้งค่า)
7. [การทดสอบ](#การทดสอบ)
8. [การ deploy และ release](#การ-deploy-และ-release)
9. [ขีดจำกัดของบริการ](#ขีดจำกัดของบริการ)
10. [License](#license)

---

## Features

### ความสามารถหลัก (ทุกแพลตฟอร์ม)

- **สองโหมดการใช้งาน**
  - **คลังในเครื่อง (ไม่ต้องมีบัญชี):** เข้ารหัสด้วยรหัสผ่านที่ตั้งเองและอยู่ในอุปกรณ์นั้นเท่านั้น ย้ายเข้าบัญชีทีหลังได้
  - **บัญชีที่ซิงค์ข้ามอุปกรณ์:** ใช้ Master Password คู่กับ Secret Key 128 บิตที่ได้ตอนสมัคร (Emergency Kit)
- ประเภทรายการ: **เข้าสู่ระบบ** (ชื่อผู้ใช้ · รหัสผ่าน · เว็บไซต์ · ความลับ TOTP) · **โน้ตลับ** · **บัตร**
- รหัสยืนยันสองขั้นตอน (TOTP) คำนวณในเครื่อง ไม่ต้องใช้เน็ต
- ตัวสร้างรหัสผ่านที่ใช้แหล่งสุ่มเชิงการเข้ารหัส
- หลาย vault ต่อบัญชี
- ล็อกอัตโนมัติเมื่อไม่ได้ใช้ 15 นาที
- ภาษาไทยและอังกฤษ

### ตารางเทียบตามแพลตฟอร์ม

| ความสามารถ | Web | Android | ส่วนขยายเบราว์เซอร์ | iOS | Desktop |
|---|:-:|:-:|:-:|:-:|:-:|
| คลังในเครื่อง (ไม่ต้องมีบัญชี) | ✅ | ✅ | ✅ | ผ่านเว็บ | ผ่านเว็บ |
| สมัครบัญชี | ✅ | — | ✅ | ผ่านเว็บ | ผ่านเว็บ |
| เข้าสู่ระบบและซิงค์ | ✅ | ✅ | ✅ | ผ่านเว็บ | ผ่านเว็บ |
| ย้ายคลังในเครื่องเข้าบัญชี | ✅ | ✅ | ✅ | ผ่านเว็บ | ผ่านเว็บ |
| สร้าง / แก้ไข / ลบรายการ | ✅ ทุกประเภท | ✅ ทุกประเภท | เฉพาะเข้าสู่ระบบ | ผ่านเว็บ | ผ่านเว็บ |
| ค้นหาและกรองรายการ | ✅ | ✅ | — | ผ่านเว็บ | ผ่านเว็บ |
| หลาย vault / ย้ายรายการ | ✅ | ✅ | — | ผ่านเว็บ | ผ่านเว็บ |
| แสดงรหัส TOTP | ✅ | ✅ | ✅ | ผ่านเว็บ | ผ่านเว็บ |
| เติมรหัสผ่านอัตโนมัติ | — | ✅ ระบบ Autofill | ✅ บนแท็บที่เปิดอยู่ | — | ส่วนขยาย |
| เติมรหัส 2FA อัตโนมัติ | — | ✅ | ✅ | — | ส่วนขยาย |
| ปลดล็อกด้วยลายนิ้วมือ | — | ✅ | — | — | — |
| ส่งออก / นำเข้าไฟล์สำรอง | ✅ | — | — | ผ่านเว็บ | ผ่านเว็บ |
| Emergency Kit | ✅ | — | ✅ ตอนสมัคร | ผ่านเว็บ | ผ่านเว็บ |
| เปลี่ยน Master Password | ✅ | ✅ | — | ผ่านเว็บ | ผ่านเว็บ |
| ออกจากระบบทุกอุปกรณ์ | ✅ | — | — | ผ่านเว็บ | ผ่านเว็บ |
| ลบบัญชี | ✅ | — | — | ผ่านเว็บ | ผ่านเว็บ |
| ติดตั้งเป็นแอป (PWA) | ✅ | — | — | ✅ Safari | ✅ Chrome/Edge |
| ติดต่อเรา / ขอลบบัญชี | ✅ ฟอร์มในเว็บ | ลิงก์ไปหน้าเว็บ | ลิงก์นโยบาย | ผ่านเว็บ | ผ่านเว็บ |

"ผ่านเว็บ" = ยังไม่มีแอป native ให้ใช้เว็บแอปแทน ซึ่งติดตั้งเป็น PWA ได้

### Web (`apps/web`)

แพลตฟอร์มที่ครบที่สุด เป็นที่เดียวที่จัดการบัญชีได้ทั้งหมด

- สมัครบัญชีและรับ **Emergency Kit** ซึ่งมีอีเมลกับ Secret Key (แสดงครั้งเดียว ดาวน์โหลดหรือพิมพ์เก็บได้)
- จัดการรายการครบทุกประเภท มีรายการโปรด ค้นหา กรองตามประเภท และย้ายรายการข้าม vault
- **ส่งออกไฟล์สำรอง** ได้สองแบบ คือเข้ารหัสด้วยรหัสผ่านที่ตั้งใหม่ (ค่าเริ่มต้น) หรือ JSON ธรรมดา มีปุ่มตรวจว่าไฟล์เปิดได้จริง และนำเข้ากลับได้ รายการที่ซ้ำจะถูกข้าม
- บัญชี: เปลี่ยน Master Password, ออกจากระบบทุกอุปกรณ์, ลบบัญชีถาวร
- คลังในเครื่องเก็บใน IndexedDB เปลี่ยนรหัสผ่านและลบคลังได้ในหน้าตั้งค่า
- ติดตั้งเป็น PWA และโหลดตัวแอปได้แม้ออฟไลน์ (ต้องต่อเน็ตเมื่อจะซิงค์)
- ธีมสว่าง / มืด / ตามระบบ
- หน้า **ติดต่อเรา** (`/contact`) และ **ขอลบบัญชี** (`/delete-account`) ส่งผ่าน API ของเราไปยัง Resend ใช้ได้โดยไม่ต้องเข้าสู่ระบบ คำขอลบบัญชีจะได้รับการยืนยันทางอีเมลของบัญชีก่อนดำเนินการ
- เมนูรวมลิงก์ ติดต่อเรา · ลบบัญชี · นโยบายความเป็นส่วนตัว · ข้อกำหนดการใช้งาน

**ข้อจำกัด:** ไม่มีการเติมรหัสผ่านอัตโนมัติในเว็บอื่น ใช้ส่วนขยายเบราว์เซอร์แทน · ในโหมดบัญชีต้องกรอกทั้งสามช่องทุกครั้งที่เปิดแอป เพราะไม่มีอะไรถูกเก็บลงเครื่อง

### Android (`apps/android`)

แอป native (Kotlin + Jetpack Compose) รองรับ Android 9 (API 28) ขึ้นไป

- คลังในเครื่อง หรือเข้าสู่ระบบบัญชีที่สมัครไว้บนเว็บ แล้วย้ายคลังในเครื่องเข้าบัญชีได้
- **บริการเติมอัตโนมัติ (Autofill Service) ของระบบ**
  - เว็บใน WebView และเบราว์เซอร์: เติมเมื่อโดเมนตรงกับเว็บไซต์ของรายการแบบตรงตัว
  - แอป native: เติมเฉพาะแอปที่พิสูจน์ตัวตนผ่าน Digital Asset Links (`/.well-known/assetlinks.json`) ได้ ถ้าพิสูจน์ไม่ได้จะไม่เติมเลย
  - มีตัวเลือกเติมรหัส 2FA แยก โดยคำนวณ ณ วินาทีที่แตะ
- **ปลดล็อกด้วยลายนิ้วมือ** (ไม่บังคับ, ต้องเป็นชีวมาตรระดับ Strong) กุญแจที่คำนวณแล้วถูกห่อด้วยกุญแจใน Android Keystore หมดอายุใน 14 วัน และถูกล้างเองเมื่อมีการเพิ่มลายนิ้วมือใหม่
- คัดลอกรหัสผ่านแบบติดป้าย "ข้อมูลอ่อนไหว" คลิปบอร์ดล้างเองใน 30 วินาที
- บล็อกการจับภาพหน้าจอ (`FLAG_SECURE`) · ไม่เข้าร่วม backup ขึ้นคลาวด์และการย้ายข้อมูลข้ามเครื่องของ Android · ตรวจลายเซ็นของแอปก่อนเปิด
- เปลี่ยน Master Password ของบัญชี หรือรหัสผ่านของคลังในเครื่อง

**ข้อจำกัด:** สมัครบัญชี, Emergency Kit, ส่งออก/นำเข้า, ออกจากระบบทุกอุปกรณ์ และลบบัญชี ต้องทำบนเว็บ · ยังไม่บันทึกรหัสผ่านใหม่อัตโนมัติจากฟอร์มของแอปอื่น · Autofill ทำงานเฉพาะตอนแอปปลดล็อกอยู่

### ส่วนขยายเบราว์เซอร์ (`apps/extension`)

ส่วนขยายแบบ Manifest V3 สำหรับ Chrome และเบราว์เซอร์ตระกูล Chromium (สร้างด้วย WXT)

- หน้าต่าง popup แสดงรายการเข้าสู่ระบบพร้อมโดเมนของแต่ละรายการ กดเดียวเติมชื่อผู้ใช้กับรหัสผ่านลงแท็บที่เปิดอยู่ ส่วนขยายจะไม่ยอมเติมถ้าเว็บในแท็บไม่ตรงกับเว็บไซต์ที่บันทึกไว้ในรายการ
- เติมหรือคัดลอกรหัส 2FA
- เพิ่มและแก้ไขรายการเข้าสู่ระบบ
- สมัครบัญชีพร้อม Emergency Kit, เข้าสู่ระบบ, คลังในเครื่อง และย้ายคลังในเครื่องเข้าบัญชี
- ขอสิทธิ์เท่าที่จำเป็น: `activeTab`, `scripting`, `clipboardWrite` และ host permission เฉพาะ API ของ Kunjae ไม่มีสิทธิ์อ่านเว็บที่ผู้ใช้เปิด ถ้าผู้ใช้ไม่ได้สั่งเอง

**ข้อจำกัด:** แสดงและแก้ไขได้เฉพาะรายการประเภทเข้าสู่ระบบ และยังไม่มีช่องค้นหา · เติมเมื่อผู้ใช้กดใน popup เท่านั้น ไม่เติมเองเมื่อโหลดหน้า · จัดการบัญชี (ส่งออก, เปลี่ยนรหัสผ่าน, ลบบัญชี) ต้องทำบนเว็บ · ยังไม่มีเวอร์ชัน Firefox และ Safari

### iOS และ Desktop

ยังไม่มีแอป native ให้ใช้เว็บแอปแทน
- iOS: เปิดใน Safari แล้ว "เพิ่มลงในหน้าจอโฮม" ได้ แต่เติมรหัสผ่านอัตโนมัติไม่ได้
- Desktop: ใช้เว็บแอป (ติดตั้งเป็น PWA ได้) คู่กับส่วนขยายเบราว์เซอร์เพื่อเติมรหัสผ่าน

---

## โมเดลความปลอดภัย

```
Master Password + Secret Key (128 บิต)
          │  Argon2id  (64 MiB · 3 รอบ · p=1)
          ▼
         MUK ──HKDF──┬──► Auth Key      ส่งให้เซิร์ฟเวอร์ ซึ่งเก็บเพียง HMAC(pepper, Auth Key)
                     └──► Wrapping Key  ไม่ออกจากอุปกรณ์ ใช้ห่อ Vault Key
                                 ▼
                         Vault Key (หนึ่งดอกต่อ vault)
                                 ▼
                     AES-256-GCM ต่อรายการ (ผูก itemId + version ใน AAD)
```

| สิ่งที่เซิร์ฟเวอร์เห็น | สิ่งที่เซิร์ฟเวอร์ไม่มีทางเห็น |
|---|---|
| อีเมล, salt, พารามิเตอร์ของ KDF | Master Password, Secret Key |
| HMAC ของ Auth Key | Wrapping Key, Vault Key |
| ciphertext ของ vault และรายการ, จำนวน, ขนาด, เวลา | ชื่อ vault, ชื่อรายการ, ชื่อผู้ใช้, รหัสผ่าน, โน้ต, ข้อมูลบัตร, ความลับ TOTP |

- **Secret Key** ทำให้ข้อมูลที่หลุดจากเซิร์ฟเวอร์เอาไปเดารหัสผ่านแบบออฟไลน์ไม่ได้ เพราะขาดกุญแจ 128 บิตที่ไม่เคยถูกส่งขึ้นเซิร์ฟเวอร์
- ถ้าลืม Master Password หรือทำ Secret Key หาย **ข้อมูลหายถาวร** ไม่มีการรีเซ็ตรหัสผ่าน
- client ตรวจพารามิเตอร์ KDF ที่เซิร์ฟเวอร์ส่งมาทุกครั้ง และปฏิเสธถ้าต่ำกว่าเกณฑ์ เพื่อกัน downgrade attack
- การเขียนใช้ optimistic concurrency (`baseVersion`) งานของอุปกรณ์อื่นจึงไม่ถูกเขียนทับเงียบๆ
- โค้ดเข้ารหัสมีสองชุด คือ TypeScript (`packages/core-crypto`) กับ Kotlin (`apps/android/core-crypto`) ทั้งคู่ถูกตรวจเทียบกันด้วยชุดข้อมูลทดสอบเดียวกันจาก `packages/crypto-spec` ให้ได้ผลตรงกันทุกไบต์

**ฝั่งเซิร์ฟเวอร์:**
- จำกัดอัตราสองชั้น: ชั้นแรกเป็น Cloudflare Rate Limiting ต่อ IP (แบบแฮช) และต่อบัญชี ชั้นที่สองเป็นโควตารายวันต่อบัญชีใน D1 คำขอที่ถูกปฏิเสธไม่เขียนลงฐานข้อมูล
- CORS แบบ allow-list, CSP เข้มงวด, `Cache-Control: no-store`
- token ผูกกับ epoch จึงเพิกถอนทุกอุปกรณ์ได้ในครั้งเดียว
- ค่าความลับไม่ครบ = ตอบ 500 ทุกคำขอ (fail closed)

รายละเอียดการจัดการข้อมูลส่วนบุคคลอยู่ใน[นโยบายความเป็นส่วนตัว](https://kunjae.pdouvch.com/privacy)

---

## สถาปัตยกรรม

```
┌────────────┐  ┌───────────────┐  ┌────────────┐
│  Web (PWA) │  │   Extension   │  │  Android   │
│ React/Vite │  │  WXT · MV3    │  │  Compose   │
└─────┬──────┘  └──────┬────────┘  └─────┬──────┘
      │   client-core · core-crypto      │  client · core-crypto (Kotlin)
      └──────────────┬───────────────────┘
                     │ HTTPS (ciphertext เท่านั้น)
          ┌──────────▼───────────┐
          │ Cloudflare Worker    │  Hono · Rate Limiting · Sentry (ไม่บังคับ)
          │ + D1 (SQLite)        │  Drizzle ORM · cron รายวัน
          └──────────────────────┘
```

| ส่วน | เทคโนโลยี |
|---|---|
| ภาษา | TypeScript (strict), Kotlin |
| เว็บ | React 19, TanStack Router, Vite, Tailwind CSS v4, Service Worker |
| ส่วนขยาย | WXT, React, Manifest V3 |
| Android | Kotlin, Jetpack Compose, Material 3, BouncyCastle (Argon2id) |
| API | Cloudflare Workers, Hono, Zod, Drizzle ORM, Cloudflare D1 |
| Monorepo | pnpm workspaces, Turborepo |
| คุณภาพโค้ด | ESLint (typescript-eslint แบบ strict), pre-commit hook ตรวจ type + lint + ความลับที่หลุดใน commit |

---

## โครงสร้าง repo

```
apps/
  web/         เว็บแอป (React + Vite) · deploy เป็น Cloudflare Worker (static assets)
  extension/   ส่วนขยายเบราว์เซอร์ (WXT)
  android/     แอป Android: app/ (UI), client/ (ชั้นเชื่อม API), core-crypto/ (พอร์ตของ core-crypto)
  api/         เซิร์ฟเวอร์ซิงค์ (Cloudflare Worker + D1) · migrations/
packages/
  core-crypto/  primitive การเข้ารหัส, ลำดับชั้นของกุญแจ, envelope, TOTP
  crypto-spec/  ชุดข้อมูลทดสอบที่ใช้ตรวจ TypeScript กับ Kotlin ให้ตรงกัน
  domain/       ชนิดของรายการ, schema, ตัวสร้างรหัสผ่าน, การปิด/เปิด vault
  contracts/    schema ของคำขอ/คำตอบ API (Zod) ใช้ร่วมกันทั้ง client และ server
  client-core/  session, store, sync, คลังในเครื่อง, ส่งออก/นำเข้า (ใช้ร่วมระหว่างเว็บกับส่วนขยาย)
scripts/
  android-dev.sh  เปิด API ในเครื่อง + emulator/มือถือ + ติดตั้งแอปด้วยคำสั่งเดียว
  icons/          สร้างไอคอนทุกขนาดจากรูปทรงชุดเดียว
  ci/             สคริปต์ที่ workflow ใช้ deploy และอัปโหลดขึ้นร้านค้า
.github/workflows/  ci · deploy · android-release · extension-release
```

---

## เริ่มพัฒนา

### สิ่งที่ต้องมี

- Node.js ≥ 22.12 และ pnpm ≥ 10 (`corepack enable pnpm`)
- สำหรับ Android: Android SDK (Gradle ดาวน์โหลด JDK 17 ให้เอง) และ emulator หรือมือถือที่เปิด USB debugging

### ติดตั้ง

```bash
pnpm install
```

### API ในเครื่อง

```bash
cd apps/api
pnpm db:migrate:local
pnpm dev                              # http://127.0.0.1:8787
```

สร้างไฟล์ `apps/api/.dev.vars` (หรือรัน `pnpm android` ครั้งหนึ่งให้สร้างให้) โดยต้องมี `AUTH_PEPPER`, `TOKEN_SECRET`, `CHALLENGE_KEY` (base64url ≥ 32 ไบต์ สร้างด้วย `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`) และ `ALLOWED_ORIGINS=http://127.0.0.1:5173`

### เว็บ

```bash
cd apps/web
echo 'VITE_API_BASE_URL=http://127.0.0.1:8787' > .env.local
pnpm dev                              # http://127.0.0.1:5173
```

เปิดที่ `127.0.0.1` ไม่ใช่ `localhost` เพราะต้องตรงกับ `ALLOWED_ORIGINS`

### ส่วนขยาย

```bash
cd apps/extension
WXT_API_BASE_URL=http://127.0.0.1:8787 pnpm dev
```

### Android

```bash
pnpm android            # เปิด API · เลือกมือถือที่เสียบ USB หรือ emulator · ติดตั้ง debug build · เปิดแอป
pnpm android --logs     # ดู logcat ต่อ
pnpm android --stop     # ปิด API ที่เปิดไว้เบื้องหลัง
```

debug build ชี้ไปที่ API ในเครื่อง (`10.0.2.2` สำหรับ emulator และ `127.0.0.1` ผ่าน `adb reverse` สำหรับมือถือจริง) ส่วน release build ชี้ไปที่ production เท่านั้น และถ้า URL ไม่ใช่ https Gradle จะไม่ยอม build

---

## การตั้งค่า

| ตัวแปร | ใช้ที่ | ความหมาย |
|---|---|---|
| `AUTH_PEPPER` · `TOKEN_SECRET` · `CHALLENGE_KEY` | API (secret) | ความลับของเซิร์ฟเวอร์ · **`AUTH_PEPPER` เปลี่ยนไม่ได้หลังมีผู้ใช้** เพราะทุกบัญชีจะเข้าไม่ได้ |
| `ALLOWED_ORIGINS` | API (secret) | origin ของเว็บที่อนุญาต คั่นด้วยจุลภาค |
| `ADMIN_TOKEN` | API (secret, ไม่บังคับ) | เปิดใช้ `GET /v1/admin/usage` |
| `RESEND_API_KEY` | API (secret) | key ของ Resend สำหรับฟอร์มติดต่อ · ไม่ตั้ง = `POST /v1/contact` ตอบ 503 |
| `CONTACT_FROM` · `CONTACT_TO` | API (secret หรือ var) | ผู้ส่ง (ต้องเป็นโดเมนที่ยืนยันใน Resend แล้ว เช่น `Kunjae <contact@pdouvch.com>`) และกล่องอีเมลที่รับ |
| `SENTRY_DSN` | API (secret, ไม่บังคับ) | เปิดการส่ง error ไป Sentry (กรองข้อมูลส่วนบุคคลออกก่อนส่ง) |
| `VITE_API_BASE_URL` | เว็บ (build) | ที่อยู่ API และถูกใส่ลง `connect-src` ของ CSP |
| `VITE_PLAY_SIGNING_CERT_SHA256` | เว็บ (build) | ลายนิ้วมือของ Play App Signing ที่ใส่ลง `assetlinks.json` |
| `VITE_PLAY_STORE_URL` · `VITE_CHROME_WEB_STORE_URL` | เว็บ (build, ไม่บังคับ) | ลิงก์ร้านค้าในข้อความชวนติดตั้ง |
| `WXT_API_BASE_URL` · `WXT_WEB_ORIGIN` | ส่วนขยาย (build) | ที่อยู่ API และเว็บ (ใช้สำหรับลิงก์นโยบาย) |
| `kunjae.releaseApiBaseUrl` · `kunjae.webOrigin` | Android (`local.properties` หรือ `KUNJAE_*`) | API และเว็บของ release build |
| `kunjae.versionCode` · `kunjae.versionName` | Android | เวอร์ชันของแอป |
| `kunjae.playSigningCertSha256` | Android | ใบรับรองของ Play App Signing ที่แอปยอมรับ ถ้าขาด แอปที่ติดตั้งจาก Play จะเปิดหน้าจอ tamper |

กุญแจลงนามแอป Android (`keystore.properties`, `*.jks`) และไฟล์ความลับของ production ต้องอยู่นอก repo เสมอ `.gitignore` กันไว้แล้ว

---

## การทดสอบ

```bash
pnpm typecheck          # ทุก package
pnpm lint
pnpm audit:deps

cd apps/android
./gradlew verifyVectors                 # core-crypto ของ Kotlin เทียบกับชุดข้อมูลทดสอบของ TypeScript
./gradlew :client:verifyAutofill        # ด่านตัดสินการเติมอัตโนมัติ + Digital Asset Links
./gradlew :client:verifyLocalVault      # คลังในเครื่อง
./gradlew :client:verifyAgainstApi      # ชั้น client กับ API ที่รันอยู่ในเครื่อง
```

ชุดตรวจของ Android เป็นโปรแกรม `main()` ไม่ใช่ JUnit ให้เรียกด้วย task ข้างบน อย่าใช้ `./gradlew test`
CI (`.github/workflows/ci.yml`) รันทุก push และทุก pull request

---

## การ deploy และ release

ทุก workflow ที่ใช้ความลับทำงานเมื่อสั่งเองหรือเมื่อติดแท็กเท่านั้น

| Workflow | ทำอะไร | ต้องตั้งค่า |
|---|---|---|
| `deploy.yml` | deploy API และ/หรือเว็บขึ้น Cloudflare | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, vars `API_BASE_URL`, `WEB_ORIGIN`, `PLAY_SIGNING_CERT_SHA256` |
| `android-release.yml` | build AAB/APK ที่ลงนามแล้ว · ส่ง Firebase App Distribution หรือ Google Play | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON` (ไม่บังคับ: `FIREBASE_*`) |
| `extension-release.yml` | build และอัปโหลดขึ้น Chrome Web Store | `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID` |

### API (ครั้งแรก)

```bash
cd apps/api
pnpm exec wrangler d1 create kunjae                       # ใส่ database_id ลง wrangler.jsonc
pnpm exec wrangler secret bulk <ไฟล์ JSON ของความลับสามตัว>   # เก็บสำเนาไว้นอก repo ก่อนเสมอ
pnpm exec wrangler secret put ALLOWED_ORIGINS
pnpm db:migrate:remote                                    # ทุกครั้งก่อน deploy
pnpm exec wrangler deploy
curl https://<worker>/health                              # → {"status":"ok"}
```

### Android บน Google Play

1. อัปโหลด AAB ตัวแรกเข้า **Internal testing**
2. คัดลอก SHA-256 ของ **App signing key certificate** จาก Play Console → App integrity
3. ตั้งค่าเป็น `vars.PLAY_SIGNING_CERT_SHA256` แล้ว deploy เว็บใหม่ (เพื่ออัปเดต `assetlinks.json`)
4. build ใหม่ด้วย `versionCode` ที่มากกว่าเดิม ผ่านแท็ก `android-v<เวอร์ชัน>`
5. ทดสอบจาก Internal testing บนมือถือจริง แล้วค่อยเลื่อนขึ้น Production

---

## ขีดจำกัดของบริการ

บริการทำงานบนแผนฟรีของ Cloudflare จึงมีเพดานเพื่อกันไม่ให้ผู้ใช้คนเดียวใช้โควตาของทุกคน

| ขีดจำกัด | ค่า |
|---|---|
| สมัคร / เข้าสู่ระบบ | 12 คำขอ/นาที ต่อ IP |
| ซิงค์ (pull / push) | 30 คำขอ/นาที ต่อบัญชี |
| เปลี่ยนรหัสผ่าน · ลบบัญชี · เพิกถอน session · สร้าง vault | 5 คำขอ/นาที ต่อบัญชี |
| โควตารายวันต่อบัญชี | pull 500 ครั้ง · push 3,000 รายการ |
| ขนาดต่อคำขอ | 1 MiB · push ได้ครั้งละ 50 รายการ · pull ได้หน้าละ 200 รายการ |
| vault ต่อบัญชี | 64 |
| ฟอร์มติดต่อ | 5 ข้อความ/ชั่วโมง ต่อ IP · รวมทั้งระบบ 50 ข้อความ/วัน (กันโควตาฟรีของ Resend 100 ฉบับ/วัน) |

เมื่อเกินเพดาน เซิร์ฟเวอร์ตอบ `429` พร้อม `Retry-After` ฝั่งเว็บและส่วนขยายจะรอแล้วลองใหม่เอง ส่วน cron ที่รันทุกวันจะลบตัวนับที่หมดอายุ และแจ้งเตือนเมื่อการใช้ D1 เข้าใกล้เพดานของแผนฟรี

---

## License

MIT ตามที่ระบุไว้ในช่อง `license` ของ `package.json` ทุก package (ยังไม่มีไฟล์ `LICENSE` ที่ root)
