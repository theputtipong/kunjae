import type { Lang } from "../i18n/index.ts";

export type LegalSection = {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
};

export type LegalDocument = {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
};

export const LEGAL_EFFECTIVE_DATE = "2026-09-27";
export const LEGAL_OPERATOR = "Puttipong Doungvichai";
export const LEGAL_CONTACT_EMAIL = "support.pdouvch@gmail.com";

const privacyEn: LegalDocument = {
  title: "Privacy Policy",
  intro:
    "Kunjae is a zero-knowledge password manager. Your vault is encrypted on your device before it is sent anywhere, and we cannot read it. This policy explains the small amount of data we do handle, why, and your rights under Thailand's Personal Data Protection Act B.E. 2562 (PDPA).",
  sections: [
    {
      heading: "1. Who we are",
      paragraphs: [
        `Kunjae is operated by ${LEGAL_OPERATOR}, an individual developer based in Thailand, who is the data controller for the data described here. Contact: ${LEGAL_CONTACT_EMAIL}.`,
        "This policy covers the Kunjae web app, the Kunjae Android app, the Kunjae browser extension and the Kunjae sync server.",
      ],
    },
    {
      heading: "2. What we can never see",
      paragraphs: [
        "Your Master Password and your Secret Key never leave your device. Everything inside your vaults — item titles, usernames, passwords, notes, card details, 2FA secrets and vault names — is encrypted with AES-256-GCM using keys derived on your device. The server stores only the encrypted result. Because we do not hold your keys, we cannot read, reset or recover your data.",
      ],
    },
    {
      heading: "3. Data we store when you use an account",
      paragraphs: ["If you create an account to sync between devices, our server stores:"],
      bullets: [
        "Your email address, used to find your account when you sign in. We do not verify it and we never send you email.",
        "A random account ID, a random salt and the settings used to derive your keys (these are not secret).",
        "A keyed hash of an authentication key your device derives from your Master Password and Secret Key. It cannot be turned back into either of them.",
        "Your encrypted vaults and items, with technical metadata we can see: IDs, version numbers, timestamps, how many vaults and items you have, their approximate size, and markers for deleted items.",
        "A session counter used to sign you out of every device when you ask us to or when you change your Master Password.",
        "Per-account daily counters of sync requests, used to protect the service from abuse. They are deleted automatically after about 3 days.",
      ],
    },
    {
      heading: "4. Data used for security and reliability",
      bullets: [
        "Abuse protection: to limit repeated sign-in and sign-up attempts, we keep counters keyed by a one-way keyed hash of your IP address and the page requested. Your raw IP address is not stored in our database, and these counters are deleted within about 25 hours.",
        "Service logs: our hosting provider, Cloudflare, processes your IP address and basic request details (such as the address requested and the time) to deliver the service and keeps operational logs for a short period.",
        "Error monitoring: if enabled, error reports are sent to Sentry. Before anything is sent we remove IP addresses, request headers, cookies, query strings, request bodies and user identifiers. Reports contain only the error, the request method, the path and the response code.",
        "Usage totals: once a day we record service-wide totals (numbers of accounts, vaults and items, and estimated storage) to stay within our hosting limits. These totals contain no personal data.",
      ],
      paragraphs: [],
    },
    {
      heading: "5. Vaults that stay on your device",
      paragraphs: [
        "If you use Kunjae without an account, your vault is encrypted with a password you choose and stored only on that device (in the browser's IndexedDB, or in the Android app's private storage). Nothing about it is sent to us unless you later move it into an account.",
      ],
    },
    {
      heading: "6. Data stored on your device",
      bullets: [
        "Web app: your theme, language, whether you have seen the introduction and whether you dismissed the install prompt (in local storage); an encrypted on-device vault if you create one (in IndexedDB); and a cached copy of the app's own files so it loads quickly.",
        "Android app: the same preferences; an encrypted on-device vault if you create one; and, only if you turn on biometric unlock, derived keys encrypted with a key held in your phone's secure hardware, which expire after 14 days. Your Master Password and Secret Key are never stored. The app opts out of Android cloud backup and device transfer.",
        "Browser extension: keys are kept in memory only; an encrypted on-device vault is stored in IndexedDB if you create one.",
        "Decrypted data is kept in memory only while your vault is unlocked. Kunjae locks itself after 15 minutes without use.",
      ],
      paragraphs: [],
    },
    {
      heading: "7. Android autofill and websites you have saved",
      paragraphs: [
        "When you use autofill inside another Android app, Kunjae checks that the app really belongs to the website saved in your login by downloading that website's public /.well-known/assetlinks.json file directly from your phone. That website can see your device's IP address, as with any visit. Nothing from your vault is sent. Autofill in web pages and browsers does not make this request.",
      ],
    },
    {
      heading: "8. What we do not do",
      bullets: [
        "No advertising, analytics, tracking pixels or third-party trackers in any Kunjae app.",
        "We do not sell, rent or share your personal data for marketing.",
        "We do not load fonts, images or scripts from other websites, and we do not fetch website icons for your saved items.",
      ],
      paragraphs: [
        "Links such as \"Buy me a coffee\" or app store pages take you to other websites with their own privacy policies.",
      ],
    },
    {
      heading: "9. Service providers and international transfers",
      paragraphs: [
        "We use Cloudflare, Inc. to host the web app and the sync server and to store the database, and, when error monitoring is enabled, Functional Software, Inc. (Sentry). They process data on our behalf and may do so in countries outside Thailand, including the United States. We rely on their contractual data protection commitments, and the vault contents they store remain encrypted with keys they do not have.",
      ],
    },
    {
      heading: "10. Why we process your data (legal basis)",
      bullets: [
        "To provide the service you asked for — creating your account, signing you in and syncing your encrypted vault (performance of a contract).",
        "To keep the service secure, prevent abuse and keep it running within its limits (our legitimate interests).",
        "To comply with the law when required.",
      ],
      paragraphs: [],
    },
    {
      heading: "11. How long we keep data",
      paragraphs: [
        "Account data is kept until you delete your account. Deleting your account (Settings on the web app) immediately removes your account, vaults and items from our database. Abuse-protection counters are removed within about 3 days. Our hosting provider's database recovery backups may retain deleted data for up to 30 days before it is permanently overwritten. Service-wide usage totals contain no personal data and may be kept indefinitely.",
      ],
    },
    {
      heading: "12. Your rights",
      paragraphs: [
        "Under the PDPA you may ask to access, receive a copy of, correct or delete your personal data, to object to or restrict its processing, and to withdraw consent where we rely on it. You can already export all of your vault data and delete your account yourself in the web app. For anything else, email us — we will reply within 30 days. You also have the right to complain to the Office of the Personal Data Protection Committee of Thailand.",
        "Because your vault is encrypted with keys only you hold, we cannot provide or recover its contents for you.",
      ],
    },
    {
      heading: "13. Children",
      paragraphs: [
        "Kunjae is not intended for children under 13. If you are under 20, you need the consent of a parent or legal guardian to use Kunjae. If you believe a child has created an account without that consent, contact us and we will delete it.",
      ],
    },
    {
      heading: "14. Security",
      paragraphs: [
        "We protect your data with end-to-end encryption, keys derived with Argon2id, keyed hashing on the server, encrypted connections and strict limits on what our apps can access. No system is completely secure; please keep your Master Password, Secret Key and devices safe.",
      ],
    },
    {
      heading: "15. Changes to this policy",
      paragraphs: [
        "We may update this policy. The date at the top shows the latest version, and we will point out significant changes in the apps before they take effect.",
      ],
    },
    {
      heading: "16. Contact",
      paragraphs: [`${LEGAL_OPERATOR} · ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const privacyTh: LegalDocument = {
  title: "นโยบายความเป็นส่วนตัว",
  intro:
    "Kunjae เป็นตัวจัดการรหัสผ่านแบบ zero-knowledge คลังข้อมูลของคุณถูกเข้ารหัสในอุปกรณ์ของคุณก่อนถูกส่งไปที่ใดก็ตาม และเราอ่านมันไม่ได้ นโยบายนี้อธิบายข้อมูลจำนวนน้อยที่เราจัดการจริง เหตุผล และสิทธิของคุณตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
  sections: [
    {
      heading: "1. เราคือใคร",
      paragraphs: [
        `Kunjae ดำเนินการโดย ${LEGAL_OPERATOR} นักพัฒนาอิสระในประเทศไทย ซึ่งเป็นผู้ควบคุมข้อมูลส่วนบุคคลตามนโยบายนี้ ติดต่อ: ${LEGAL_CONTACT_EMAIL}`,
        "นโยบายนี้ครอบคลุมเว็บแอป Kunjae แอป Kunjae บน Android ส่วนขยายเบราว์เซอร์ Kunjae และเซิร์ฟเวอร์ซิงค์ของ Kunjae",
      ],
    },
    {
      heading: "2. สิ่งที่เราไม่มีทางเห็น",
      paragraphs: [
        "Master Password และ Secret Key ของคุณไม่เคยออกจากอุปกรณ์ของคุณ ทุกอย่างในคลังข้อมูล ได้แก่ ชื่อรายการ ชื่อผู้ใช้ รหัสผ่าน โน้ต ข้อมูลบัตร ความลับ 2FA และชื่อ vault ถูกเข้ารหัสด้วย AES-256-GCM ด้วยกุญแจที่คำนวณในอุปกรณ์ของคุณ เซิร์ฟเวอร์เก็บเฉพาะผลลัพธ์ที่เข้ารหัสแล้ว เมื่อเราไม่มีกุญแจ เราจึงอ่าน รีเซ็ต หรือกู้คืนข้อมูลของคุณไม่ได้",
      ],
    },
    {
      heading: "3. ข้อมูลที่เราเก็บเมื่อคุณใช้บัญชี",
      paragraphs: ["หากคุณสร้างบัญชีเพื่อซิงค์ระหว่างอุปกรณ์ เซิร์ฟเวอร์ของเราจะเก็บ:"],
      bullets: [
        "อีเมลของคุณ ใช้ค้นหาบัญชีเมื่อคุณเข้าสู่ระบบ เราไม่ได้ยืนยันอีเมลและไม่เคยส่งอีเมลถึงคุณ",
        "รหัสบัญชีแบบสุ่ม ค่า salt แบบสุ่ม และค่าตั้งที่ใช้คำนวณกุญแจ (ไม่ใช่ความลับ)",
        "ค่าแฮชแบบมีกุญแจของกุญแจยืนยันตัวตนที่อุปกรณ์คำนวณจาก Master Password และ Secret Key ซึ่งแปลงกลับเป็นทั้งสองอย่างไม่ได้",
        "vault และรายการที่เข้ารหัสแล้ว พร้อมข้อมูลทางเทคนิคที่เรามองเห็น ได้แก่ รหัส หมายเลขเวอร์ชัน เวลา จำนวน vault และรายการ ขนาดโดยประมาณ และเครื่องหมายของรายการที่ลบแล้ว",
        "ตัวนับ session ที่ใช้ออกจากระบบทุกอุปกรณ์เมื่อคุณสั่ง หรือเมื่อคุณเปลี่ยน Master Password",
        "ตัวนับจำนวนคำขอซิงค์รายวันต่อบัญชี ใช้ป้องกันการใช้บริการในทางที่ผิด และถูกลบอัตโนมัติภายในประมาณ 3 วัน",
      ],
    },
    {
      heading: "4. ข้อมูลที่ใช้เพื่อความปลอดภัยและความเสถียร",
      bullets: [
        "การป้องกันการใช้ในทางที่ผิด: เพื่อจำกัดการพยายามเข้าสู่ระบบและสมัครซ้ำๆ เราเก็บตัวนับที่อ้างอิงด้วยค่าแฮชทางเดียวแบบมีกุญแจของหมายเลข IP กับหน้าที่ร้องขอ เราไม่เก็บหมายเลข IP ดิบในฐานข้อมูล และตัวนับเหล่านี้ถูกลบภายในประมาณ 25 ชั่วโมง",
        "บันทึกการทำงาน: ผู้ให้บริการโฮสต์ของเรา คือ Cloudflare ประมวลผลหมายเลข IP และรายละเอียดพื้นฐานของคำขอ (เช่น ที่อยู่ที่ร้องขอและเวลา) เพื่อให้บริการ และเก็บบันทึกการทำงานไว้ช่วงสั้นๆ",
        "การติดตามข้อผิดพลาด: หากเปิดใช้ รายงานข้อผิดพลาดจะถูกส่งไปยัง Sentry ก่อนส่งเราลบหมายเลข IP, header ของคำขอ, cookie, query string, เนื้อหาของคำขอ และตัวระบุผู้ใช้ออกทั้งหมด รายงานมีเพียงข้อผิดพลาด ประเภทคำขอ path และรหัสผลลัพธ์",
        "ยอดรวมการใช้งาน: วันละครั้งเราบันทึกยอดรวมทั้งระบบ (จำนวนบัญชี vault รายการ และพื้นที่โดยประมาณ) เพื่อให้อยู่ในขีดจำกัดของโฮสต์ ยอดรวมนี้ไม่มีข้อมูลส่วนบุคคล",
      ],
      paragraphs: [],
    },
    {
      heading: "5. คลังข้อมูลที่อยู่ในอุปกรณ์ของคุณเท่านั้น",
      paragraphs: [
        "หากคุณใช้ Kunjae โดยไม่มีบัญชี คลังข้อมูลจะถูกเข้ารหัสด้วยรหัสผ่านที่คุณตั้งและเก็บไว้ในอุปกรณ์นั้นเท่านั้น (ใน IndexedDB ของเบราว์เซอร์ หรือในพื้นที่ส่วนตัวของแอป Android) ไม่มีข้อมูลใดของคลังนี้ถูกส่งมาถึงเรา เว้นแต่คุณย้ายมันเข้าบัญชีในภายหลัง",
      ],
    },
    {
      heading: "6. ข้อมูลที่เก็บในอุปกรณ์ของคุณ",
      bullets: [
        "เว็บแอป: ธีม ภาษา สถานะว่าเคยดูหน้าแนะนำแล้ว และสถานะว่าปิดข้อความชวนติดตั้งแล้ว (ใน local storage) คลังข้อมูลในเครื่องที่เข้ารหัสแล้วหากคุณสร้างไว้ (ใน IndexedDB) และสำเนาไฟล์ของตัวแอปเองเพื่อให้โหลดเร็ว",
        "แอป Android: ค่าตั้งแบบเดียวกัน คลังข้อมูลในเครื่องที่เข้ารหัสแล้วหากคุณสร้างไว้ และเฉพาะเมื่อคุณเปิดการปลดล็อกด้วยชีวมาตร กุญแจที่คำนวณแล้วซึ่งเข้ารหัสด้วยกุญแจในฮาร์ดแวร์ความปลอดภัยของโทรศัพท์ และหมดอายุใน 14 วัน แอปไม่เคยเก็บ Master Password และ Secret Key และไม่เข้าร่วมการสำรองข้อมูลขึ้นคลาวด์หรือการย้ายข้อมูลข้ามเครื่องของ Android",
        "ส่วนขยายเบราว์เซอร์: เก็บกุญแจไว้ในหน่วยความจำเท่านั้น และเก็บคลังข้อมูลในเครื่องที่เข้ารหัสแล้วไว้ใน IndexedDB หากคุณสร้างไว้",
        "ข้อมูลที่ถอดรหัสแล้วอยู่ในหน่วยความจำเฉพาะขณะที่คลังปลดล็อกอยู่ และ Kunjae จะล็อกเองเมื่อไม่มีการใช้งาน 15 นาที",
      ],
      paragraphs: [],
    },
    {
      heading: "7. การป้อนอัตโนมัติบน Android กับเว็บไซต์ที่คุณบันทึกไว้",
      paragraphs: [
        "เมื่อคุณใช้การป้อนอัตโนมัติในแอป Android อื่น Kunjae จะตรวจว่าแอปนั้นเป็นของเว็บไซต์ที่บันทึกไว้ในรายการจริง โดยดาวน์โหลดไฟล์สาธารณะ /.well-known/assetlinks.json ของเว็บไซต์นั้นจากโทรศัพท์ของคุณโดยตรง เว็บไซต์นั้นจะเห็นหมายเลข IP ของอุปกรณ์เหมือนการเข้าเว็บทั่วไป ไม่มีข้อมูลใดในคลังถูกส่งออกไป การป้อนอัตโนมัติในหน้าเว็บและเบราว์เซอร์ไม่มีคำขอนี้",
      ],
    },
    {
      heading: "8. สิ่งที่เราไม่ทำ",
      bullets: [
        "ไม่มีโฆษณา ระบบวิเคราะห์การใช้งาน pixel ติดตาม หรือตัวติดตามของบุคคลที่สามในแอปใดของ Kunjae",
        "เราไม่ขาย ให้เช่า หรือแบ่งปันข้อมูลส่วนบุคคลของคุณเพื่อการตลาด",
        "เราไม่โหลดฟอนต์ รูปภาพ หรือสคริปต์จากเว็บไซต์อื่น และไม่ดึงไอคอนของเว็บไซต์ในรายการที่คุณบันทึก",
      ],
      paragraphs: ["ลิงก์อย่าง \"Buy me a coffee\" หรือหน้าร้านแอปพาคุณไปยังเว็บไซต์อื่นที่มีนโยบายความเป็นส่วนตัวของตัวเอง"],
    },
    {
      heading: "9. ผู้ให้บริการและการส่งข้อมูลไปต่างประเทศ",
      paragraphs: [
        "เราใช้ Cloudflare, Inc. เป็นโฮสต์ของเว็บแอปและเซิร์ฟเวอร์ซิงค์ และเป็นที่เก็บฐานข้อมูล และเมื่อเปิดการติดตามข้อผิดพลาด ใช้ Functional Software, Inc. (Sentry) ผู้ให้บริการเหล่านี้ประมวลผลข้อมูลแทนเรา และอาจประมวลผลในประเทศนอกประเทศไทย รวมถึงสหรัฐอเมริกา เราอาศัยข้อผูกพันด้านการคุ้มครองข้อมูลตามสัญญาของผู้ให้บริการ และเนื้อหาในคลังที่เก็บไว้ยังคงเข้ารหัสด้วยกุญแจที่ผู้ให้บริการไม่มี",
      ],
    },
    {
      heading: "10. ฐานทางกฎหมายในการประมวลผล",
      bullets: [
        "เพื่อให้บริการที่คุณร้องขอ ได้แก่ สร้างบัญชี ให้เข้าสู่ระบบ และซิงค์คลังที่เข้ารหัสแล้ว (การปฏิบัติตามสัญญา)",
        "เพื่อรักษาความปลอดภัย ป้องกันการใช้ในทางที่ผิด และให้บริการทำงานได้ภายในขีดจำกัด (ประโยชน์โดยชอบด้วยกฎหมาย)",
        "เพื่อปฏิบัติตามกฎหมายเมื่อจำเป็น",
      ],
      paragraphs: [],
    },
    {
      heading: "11. ระยะเวลาการเก็บรักษา",
      paragraphs: [
        "ข้อมูลบัญชีถูกเก็บจนกว่าคุณจะลบบัญชี การลบบัญชี (ในหน้าตั้งค่าของเว็บแอป) จะลบบัญชี vault และรายการของคุณออกจากฐานข้อมูลทันที ตัวนับเพื่อป้องกันการใช้ในทางที่ผิดถูกลบภายในประมาณ 3 วัน ข้อมูลสำรองเพื่อกู้คืนฐานข้อมูลของผู้ให้บริการโฮสต์อาจยังมีข้อมูลที่ลบแล้วอยู่ได้ไม่เกิน 30 วันก่อนถูกเขียนทับถาวร ส่วนยอดรวมการใช้งานทั้งระบบไม่มีข้อมูลส่วนบุคคลและอาจเก็บไว้โดยไม่มีกำหนด",
      ],
    },
    {
      heading: "12. สิทธิของคุณ",
      paragraphs: [
        "ตาม PDPA คุณมีสิทธิขอเข้าถึง ขอรับสำเนา ขอแก้ไข หรือขอลบข้อมูลส่วนบุคคล คัดค้านหรือขอให้ระงับการประมวลผล และถอนความยินยอมในกรณีที่เราอาศัยความยินยอม คุณส่งออกข้อมูลทั้งหมดในคลังและลบบัญชีได้เองในเว็บแอปอยู่แล้ว สำหรับเรื่องอื่นให้ส่งอีเมลถึงเรา เราจะตอบภายใน 30 วัน คุณยังมีสิทธิร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล",
        "เนื่องจากคลังของคุณเข้ารหัสด้วยกุญแจที่มีแต่คุณถือ เราจึงให้หรือกู้คืนเนื้อหาในคลังแทนคุณไม่ได้",
      ],
    },
    {
      heading: "13. เด็ก",
      paragraphs: [
        "Kunjae ไม่ได้มีไว้สำหรับเด็กอายุต่ำกว่า 13 ปี หากคุณอายุต่ำกว่า 20 ปี ต้องได้รับความยินยอมจากบิดามารดาหรือผู้ปกครองตามกฎหมายก่อนใช้ Kunjae หากคุณเชื่อว่าเด็กสร้างบัญชีโดยไม่ได้รับความยินยอมนั้น โปรดติดต่อเรา และเราจะลบบัญชีนั้น",
      ],
    },
    {
      heading: "14. ความปลอดภัย",
      paragraphs: [
        "เราปกป้องข้อมูลด้วยการเข้ารหัสแบบต้นทางถึงปลายทาง กุญแจที่คำนวณด้วย Argon2id การแฮชแบบมีกุญแจบนเซิร์ฟเวอร์ การเชื่อมต่อที่เข้ารหัส และการจำกัดสิทธิ์ของแอปอย่างเข้มงวด ไม่มีระบบใดปลอดภัยสมบูรณ์ โปรดเก็บ Master Password, Secret Key และอุปกรณ์ของคุณให้ปลอดภัย",
      ],
    },
    {
      heading: "15. การเปลี่ยนแปลงนโยบาย",
      paragraphs: [
        "เราอาจปรับปรุงนโยบายนี้ วันที่ด้านบนแสดงฉบับล่าสุด และเราจะแจ้งการเปลี่ยนแปลงสำคัญในแอปก่อนมีผลบังคับใช้",
      ],
    },
    {
      heading: "16. ติดต่อ",
      paragraphs: [`${LEGAL_OPERATOR} · ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const termsEn: LegalDocument = {
  title: "Terms of Use",
  intro:
    "These terms are an agreement between you and the operator of Kunjae. By creating a vault or an account, or otherwise using Kunjae, you agree to them. If you do not agree, do not use Kunjae.",
  sections: [
    {
      heading: "1. Who can use Kunjae",
      paragraphs: [
        "You must be at least 13 years old. If you are under 20, you must have the consent of a parent or legal guardian, who agrees to these terms on your behalf.",
      ],
    },
    {
      heading: "2. The service",
      paragraphs: [
        "Kunjae lets you store passwords, secure notes, cards and 2FA secrets in an encrypted vault, either only on your device or in an account that syncs between the web app, the Android app and the browser extension. Kunjae is currently provided free of charge. Donations are voluntary and do not buy any extra rights or features.",
      ],
    },
    {
      heading: "3. Your Master Password, Secret Key and backups",
      paragraphs: [
        "Kunjae is designed so that nobody but you can decrypt your vault. This means you alone are responsible for keeping your Master Password, your Secret Key (Emergency Kit) and any on-device vault password safe.",
        "If you lose them, we cannot recover your data — there is no password reset. You are responsible for keeping backups, for example by exporting your vault regularly from the web app.",
      ],
    },
    {
      heading: "4. Acceptable use",
      paragraphs: ["You agree not to:"],
      bullets: [
        "use Kunjae to break any law or to store content you have no right to hold;",
        "attack, overload or disrupt the service, including by sending automated or excessive requests or trying to get around rate limits and quotas;",
        "try to access another person's account or data;",
        "resell the service or offer it to others as your own.",
      ],
    },
    {
      heading: "5. Limits, availability and changes",
      paragraphs: [
        "The service runs on free hosting plans and applies rate limits and daily quotas. Requests beyond them may be refused. We do not guarantee that Kunjae will always be available or error-free. We may change, suspend or discontinue features or the service. If we plan to shut down the sync service, we will give reasonable notice in the apps so you can export your data.",
      ],
    },
    {
      heading: "6. Your data",
      paragraphs: [
        "Your vault content remains yours. You give us permission only to store and transmit it, in encrypted form, to provide the service. How we handle personal data is described in the Privacy Policy.",
      ],
    },
    {
      heading: "7. Ending your use",
      paragraphs: [
        "You can stop using Kunjae at any time, delete an on-device vault, or delete your account in the web app's Settings. We may suspend or delete an account that breaks these terms or threatens the service or other users. Where possible we will warn you first.",
      ],
    },
    {
      heading: "8. Disclaimer",
      paragraphs: [
        "Kunjae is provided \"as is\" and \"as available\", without warranties of any kind, to the fullest extent permitted by law. We do not warrant that it is free of defects or that it will meet every need.",
      ],
    },
    {
      heading: "9. Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by Thai law, we are not liable for indirect or consequential loss, or for loss of data caused by a lost Master Password, Secret Key or device, by your own actions, or by events outside our reasonable control. Nothing in these terms limits liability that cannot be limited by law, including for gross negligence or wilful misconduct.",
      ],
    },
    {
      heading: "10. Governing law",
      paragraphs: [
        "These terms are governed by the laws of Thailand, and the courts of Thailand have jurisdiction over any dispute. If the Thai and English versions differ, the Thai version prevails.",
      ],
    },
    {
      heading: "11. Changes to these terms",
      paragraphs: [
        "We may update these terms. The date at the top shows the latest version. We will point out significant changes in the apps before they take effect. If you keep using Kunjae after that, you accept the updated terms.",
      ],
    },
    {
      heading: "12. Contact",
      paragraphs: [`${LEGAL_OPERATOR} · ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const termsTh: LegalDocument = {
  title: "ข้อกำหนดการใช้งาน",
  intro:
    "ข้อกำหนดนี้เป็นข้อตกลงระหว่างคุณกับผู้ให้บริการ Kunjae เมื่อคุณสร้างคลังข้อมูลหรือบัญชี หรือใช้ Kunjae ด้วยวิธีอื่น ถือว่าคุณยอมรับข้อกำหนดนี้ หากไม่ยอมรับ โปรดอย่าใช้ Kunjae",
  sections: [
    {
      heading: "1. ผู้ที่ใช้ Kunjae ได้",
      paragraphs: [
        "คุณต้องมีอายุอย่างน้อย 13 ปี หากอายุต่ำกว่า 20 ปี ต้องได้รับความยินยอมจากบิดามารดาหรือผู้ปกครองตามกฎหมาย ซึ่งยอมรับข้อกำหนดนี้แทนคุณ",
      ],
    },
    {
      heading: "2. บริการ",
      paragraphs: [
        "Kunjae ให้คุณเก็บรหัสผ่าน โน้ตลับ ข้อมูลบัตร และความลับ 2FA ไว้ในคลังที่เข้ารหัส ทั้งแบบที่อยู่ในอุปกรณ์เท่านั้น และแบบบัญชีที่ซิงค์ระหว่างเว็บแอป แอป Android และส่วนขยายเบราว์เซอร์ ปัจจุบัน Kunjae ให้บริการโดยไม่มีค่าใช้จ่าย การสนับสนุนเป็นไปโดยสมัครใจ และไม่ได้ให้สิทธิหรือฟีเจอร์เพิ่มเติม",
      ],
    },
    {
      heading: "3. Master Password, Secret Key และการสำรองข้อมูล",
      paragraphs: [
        "Kunjae ถูกออกแบบให้ไม่มีใครถอดรหัสคลังของคุณได้นอกจากคุณ ดังนั้นคุณเป็นผู้รับผิดชอบแต่เพียงผู้เดียวในการเก็บรักษา Master Password, Secret Key (Emergency Kit) และรหัสผ่านของคลังในเครื่องให้ปลอดภัย",
        "หากทำหาย เรากู้คืนข้อมูลของคุณไม่ได้ เพราะไม่มีการรีเซ็ตรหัสผ่าน คุณเป็นผู้รับผิดชอบการสำรองข้อมูล เช่น ส่งออกคลังจากเว็บแอปเป็นประจำ",
      ],
    },
    {
      heading: "4. การใช้งานที่ยอมรับได้",
      paragraphs: ["คุณตกลงว่าจะไม่:"],
      bullets: [
        "ใช้ Kunjae ทำผิดกฎหมาย หรือเก็บเนื้อหาที่คุณไม่มีสิทธิครอบครอง",
        "โจมตี ทำให้บริการทำงานหนักเกินไป หรือรบกวนบริการ รวมถึงการส่งคำขออัตโนมัติหรือคำขอจำนวนมากเกินควร หรือพยายามหลบเลี่ยงการจำกัดอัตราและโควตา",
        "พยายามเข้าถึงบัญชีหรือข้อมูลของผู้อื่น",
        "ขายต่อบริการ หรือนำบริการไปเสนอให้ผู้อื่นในนามของคุณ",
      ],
    },
    {
      heading: "5. ขีดจำกัด ความพร้อมใช้งาน และการเปลี่ยนแปลง",
      paragraphs: [
        "บริการทำงานบนแผนโฮสต์แบบฟรี และมีการจำกัดอัตราและโควตารายวัน คำขอที่เกินอาจถูกปฏิเสธ เราไม่รับประกันว่า Kunjae จะพร้อมใช้งานตลอดเวลาหรือปราศจากข้อผิดพลาด เราอาจเปลี่ยนแปลง ระงับ หรือยุติฟีเจอร์หรือบริการได้ หากเราวางแผนจะปิดบริการซิงค์ เราจะแจ้งล่วงหน้าตามสมควรในแอป เพื่อให้คุณส่งออกข้อมูลได้",
      ],
    },
    {
      heading: "6. ข้อมูลของคุณ",
      paragraphs: [
        "เนื้อหาในคลังยังคงเป็นของคุณ คุณอนุญาตให้เราเก็บและส่งต่อเนื้อหานั้นในรูปที่เข้ารหัสแล้วเพื่อให้บริการเท่านั้น วิธีที่เราจัดการข้อมูลส่วนบุคคลอยู่ในนโยบายความเป็นส่วนตัว",
      ],
    },
    {
      heading: "7. การเลิกใช้งาน",
      paragraphs: [
        "คุณเลิกใช้ Kunjae ลบคลังในเครื่อง หรือลบบัญชีในหน้าตั้งค่าของเว็บแอปได้ทุกเมื่อ เราอาจระงับหรือลบบัญชีที่ฝ่าฝืนข้อกำหนดนี้ หรือเป็นภัยต่อบริการหรือผู้ใช้อื่น โดยจะเตือนก่อนเมื่อทำได้",
      ],
    },
    {
      heading: "8. การปฏิเสธความรับผิด",
      paragraphs: [
        "Kunjae ให้บริการ \"ตามสภาพ\" และ \"ตามที่มี\" โดยไม่มีการรับประกันใดๆ เท่าที่กฎหมายอนุญาต เราไม่รับประกันว่าบริการจะปราศจากข้อบกพร่อง หรือตอบโจทย์ทุกความต้องการ",
      ],
    },
    {
      heading: "9. การจำกัดความรับผิด",
      paragraphs: [
        "เท่าที่กฎหมายไทยอนุญาต เราไม่รับผิดต่อความเสียหายทางอ้อมหรือความเสียหายต่อเนื่อง หรือการสูญหายของข้อมูลอันเกิดจากการทำ Master Password, Secret Key หรืออุปกรณ์หาย จากการกระทำของคุณเอง หรือจากเหตุการณ์ที่อยู่นอกเหนือการควบคุมตามสมควรของเรา ข้อกำหนดนี้ไม่จำกัดความรับผิดที่กฎหมายห้ามจำกัด รวมถึงความรับผิดจากความประมาทเลินเล่ออย่างร้ายแรงหรือการจงใจกระทำผิด",
      ],
    },
    {
      heading: "10. กฎหมายที่ใช้บังคับ",
      paragraphs: [
        "ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย และศาลไทยมีเขตอำนาจพิจารณาข้อพิพาท หากฉบับภาษาไทยและภาษาอังกฤษแตกต่างกัน ให้ถือฉบับภาษาไทยเป็นหลัก",
      ],
    },
    {
      heading: "11. การเปลี่ยนแปลงข้อกำหนด",
      paragraphs: [
        "เราอาจปรับปรุงข้อกำหนดนี้ วันที่ด้านบนแสดงฉบับล่าสุด เราจะแจ้งการเปลี่ยนแปลงสำคัญในแอปก่อนมีผลบังคับใช้ หากคุณยังใช้ Kunjae ต่อหลังจากนั้น ถือว่าคุณยอมรับข้อกำหนดที่ปรับปรุงแล้ว",
      ],
    },
    {
      heading: "12. ติดต่อ",
      paragraphs: [`${LEGAL_OPERATOR} · ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

export const PRIVACY_POLICY: Readonly<Record<Lang, LegalDocument>> = { en: privacyEn, th: privacyTh };
export const TERMS_OF_USE: Readonly<Record<Lang, LegalDocument>> = { en: termsEn, th: termsTh };
