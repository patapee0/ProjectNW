# แผนออกแบบ KKU Dating: เว็บ, Flutter และ Firebase

## เป้าหมาย

- ใช้โปรเจกต์ Firebase กลางสำหรับเว็บและแอป Flutter; สมาชิกล็อกอินและเห็นโปรไฟล์/แมตช์/ข้อความชุดเดียวกัน
- ให้ระบบทำงานผ่านอินเทอร์เน็ตจากเครือข่ายใดก็ได้ โดยให้เว็บลง Firebase Hosting และให้ Android/iOS ติดตั้งเป็นแอป native
- ป้องกันการเข้าถึงข้อมูลของบัญชีอื่น และไม่ถือว่าเพียงกรอกอีเมล `@kkumail.com` คือการยืนยันตัวตน
- เก็บข้อมูลและสื่อในบริการ cloud ไม่พึ่ง MongoDB ที่เครื่องนักพัฒนา หรือข้อมูลในหน่วยความจำ backend

## ภาพรวมสถาปัตยกรรมเป้าหมาย

```text
Web (Firebase Hosting) ── Firebase Auth / Firestore / Storage
Flutter Android/iOS ───── Firebase Auth / Firestore / Storage
                              │
                              └── Cloud Functions (match, reports, push, admin tasks)
```

Flutter Web, Android และ iOS ใช้ Firebase project เดียวกันและเชื่อม Firebase cloud ผ่าน HTTPS/TLS โดยตรง การทำงานจึงไม่ขึ้นกับ IP ของเครื่องพัฒนา, Socket.IO บน Wi-Fi ในห้องเดียวกัน หรือ Expo Go ส่วน Firestore SDK เก็บ cache บนมือถือสำหรับข้อมูลที่เคยอ่าน; การสมัคร, sync และส่งข้อความยังต้องมีอินเทอร์เน็ต

## แบ่งงานระบบ

### หน้าบ้าน

- เว็บเป้าหมาย: Flutter Web จาก `kku_dating_flutter/` บน Firebase Hosting; แชร์หน้าและ Firebase data layer กับ Android/iOS
- เว็บ legacy: สำรองและย้ายข้อมูลที่ต้องเก็บจาก `app.js`, ปิด API/socket เดิม และ redirect domain มายัง Hosting หลังตรวจ feature parity
- มือถือ: ใช้ `kku_dating_flutter/` เป็นตัวแอปหลัก, แยกหน้าเข้าสู่ระบบ/ยืนยันอีเมล/สร้างโปรไฟล์/ค้นพบ/แชท/โปรไฟล์
- ให้แต่ละ client เรียกบริการข้อมูลร่วมและใช้ UID จาก Firebase Authentication; ห้ามเชื่อ UID ที่ client ส่งมาแทน session
- แสดง loading, empty, network error และ retry; รองรับ cache ของ Firestore และจัดการ cache/ออกจากระบบอย่างเหมาะสม
- เพิ่มเลือกรูป, บีบอัด/จำกัดขนาด, upload progress, push notification และ deep link ในระยะถัดไป

### หลังบ้านและข้อมูล

- Firebase Authentication: Email/Password + verification link; จำกัดสมัครด้วยโดเมน KKU และต้องผ่าน `emailVerified`; ถ้าหน่วยงานมหาวิทยาลัยเปิด SSO ให้ใช้ OIDC แทนการเชื่อโดเมนอย่างเดียว
- Cloud Firestore: profiles, swipes, matches, messages, blocks, reports และ consents
- Cloud Storage: รูป/วิดีโอ แยก path ตาม UID พร้อมตรวจชนิดและขนาด
- Cloud Functions: ตรวจ swipe แบบ idempotent, สร้าง match, ส่ง FCM, moderation/admin actions, cleanup และลบบัญชี
- Firebase Security Rules: ปฏิเสธโดยปริยาย; จำกัดเอกสาร/ฟิลด์ตามเจ้าของและสมาชิก match; deploy rules ก่อนปล่อยแอป
- Firebase App Check, Auth rate limits, monitoring, backup/export และ privacy/data deletion ก่อน public launch

## Firestore data model ที่เสนอ

| Path | ข้อมูลหลัก | สิทธิ์หลัก |
| --- | --- | --- |
| `users/{uid}` | ชื่อ, อายุ, คณะ, bio, URL สื่อ, สถานะค้นพบ | verified users อ่าน public profile; เจ้าของแก้ไขของตน |
| `swipes/{uid}_{targetUid}` | ผู้ส่ง, เป้าหมาย, like/pass/superlike, เวลา | ผู้ใช้เขียน swipe ของตนเอง; จำกัดการอ่านเฉพาะผู้เกี่ยวข้อง/Functions |
| `matches/{sortedUidA_sortedUidB}` | สมาชิก 2 UID, เวลา, last message | สมาชิกแมตช์อ่าน; Functions เป็นผู้สร้าง/ควบคุมสถานะ |
| `matches/{matchId}/messages/{messageId}` | sender UID, text, เวลา, read state | สมาชิก match อ่าน; สมาชิกส่งในนามตนเอง |
| `users/{uid}/blocks/{targetUid}` | ผู้ถูกบล็อก, เวลา | เจ้าของและ Functions |
| `reports/{reportId}` | reporter, target, category, evidence refs, status | ผู้รายงานสร้าง; เฉพาะทีม moderation อ่าน/แก้ |
| `matches/{matchId}/consents/{uid}` | ความยินยอมและประเภทข้อมูล | สมาชิก match; เปิดเผยข้อมูลได้เมื่อทั้งคู่ยินยอม |

อย่าเก็บอีเมลส่วนตัว, token, ข้อมูลติดต่อ หรือ role ผู้ดูแลไว้ใน public profile ที่สมาชิกทั่วไป query ได้

## หน้าผู้ดูแลระบบ

ทำหน้า admin แยก route/build และตรวจ custom claims ฝั่ง Firebase Admin/Cloud Functions ทุกคำสั่ง ไม่ให้ผู้ใช้กำหนด `role: admin` เอง ฟีเจอร์เริ่มต้น: dashboard จำนวนบัญชี/รายงาน, queue ตรวจรายงาน, ระงับบัญชี, จัดการ block/ลบข้อมูลตามคำขอ และ audit log ผู้ดูแลควรเห็นข้อมูลเท่าที่จำเป็นและมี role แยก moderator/admin

## สิ่งที่ตรวจพบในโปรเจกต์

| ระดับ | จุดที่พบ | ผลกระทบ/แนวแก้ |
| --- | --- | --- |
| P0 | `backend/routes/authRoutes.js` ยอมรับอีเมลโดเมน KKU แล้วสร้าง token จำลอง/อนุมัติบัญชีที่ไม่มีในรายการตัวอย่าง | ไม่ใช่การยืนยันตัวตน; ใช้ Firebase Auth email verification หรือ KKU SSO |
| P0 | `backend/socket/socketHandler.js` ผูก user ID จาก event ที่ client เลือกเองและ broadcast chat/match/call ด้วย `io.emit` | ปลอมตัวและข้อมูลรั่วข้ามผู้ใช้; ปิด backend เก่าจาก public traffic จนย้าย Firebase/ล็อก authorization แล้ว |
| P0 | `backend/routes/privacyRoutes.js` เก็บ consent ใน memory และคืนข้อมูล contact ทั้งหมดเมื่อมี mutual consent; block/report ไม่ persist | restart แล้วหายและข้อมูลส่วนตัวรั่วได้; ย้ายไป Functions/Firestore และอ่านเฉพาะผู้มีสิทธิ์ |
| P1 | `backend/config/db.js` ถ้า MongoDB ต่อไม่ได้สลับไป in-memory; `seed.js` และ demo profiles ปะปนกับเส้นทางใช้งาน | ข้อมูลสูญเมื่อ restart และ demo ถูกนับเป็นคนจริง; ยกเลิก fallback ใน production, แยก seed/dev data |
| P1 | `backend/routes/swipeRoutes.js` สร้าง match ให้ demo ID ที่ขึ้นต้นด้วย `p`, validate action ไม่ครบและไม่บังคับผู้ใช้จาก session | match ปลอม/คำขอซ้ำได้; ให้ Cloud Function ตรวจ mutual likes และทำ idempotency |
| P1 | `backend/routes/chatRoutes.js` อ่านด้วย user IDs ที่ผู้เรียกกำหนดได้; schema Message และการบันทึก `matchId` ไม่สอดคล้อง | อาจอ่านบทสนทนาผู้อื่น/ประวัติไม่ขึ้น; ใช้ match membership และโครงสร้าง nested messages เดียว |
| P1 | `app.js` มี `localStorage` เป็นแหล่งข้อมูลและ fallback demo; หน้าเว็บไม่ใช้ Firebase SDK โดยตรง | ข้อมูลแต่ละ browser ไม่ sync กับมือถือ; ย้าย auth/profile/swipe/chat ไป Firebase |
| P1 | `kku_dating_flutter` เดิมเป็น starter: ไม่ initialize Firebase, หน้า login ไม่มี logic, package/application ID เป็น example และ widget test ยังเป็น counter template | build ได้ไม่เท่ากับแอปใช้งานจริง; เพิ่ม Firebase bootstrap, auth/profile/swipe/chat และเปลี่ยน ID |
| P2 | มีแอป Expo อีกชุดใน `mobile/` ที่ใช้ Express API/IP และ socket; README เดิมอธิบาย Expo Go + LAN และ MongoDB | ทีมอาจแก้คนละ mobile app; ให้ Flutter เป็นแนวทางหลักและทำเครื่องหมาย Expo ว่า legacy จนย้าย feature parity ครบ |
| P2 | voice call ใน backend relay event/audio chunks และ mobile มี SDP mock/demo | ยังไม่ใช่การโทรส่วนตัวที่ปลอดภัย; ซ่อน/ปิดฟีเจอร์จนทำ WebRTC + TURN + authorization + call lifecycle จริง |
| P2 | Android Flutter ใช้ debug signing ใน release template; iOS build ต้องใช้ Apple signing และ macOS | ห้ามส่ง APK debug-key ขึ้น Store; กำหนด keystore, provisioning, privacy declarations และ CI บน macOS |

## แผนดำเนินงานตามลำดับ

1. **ตั้ง Firebase และ rules:** สร้าง platform apps, เปิด Auth/Firestore/Storage, deploy rules/indexes, ตั้ง staging และ production แยก project
2. **ยืนยันตัวตนและโปรไฟล์:** email verification/SSO, profile ownership, delete account และห้ามข้อมูลส่วนบุคคลใน public queries
3. **ย้ายข้อมูลเว็บ:** เปลี่ยน login/profile/feed/swipe/chat จาก REST/localStorage ไป Firebase; deploy Hosting; ย้าย/แปลงข้อมูลเก่าหลังทำ backup และ dedupe
4. **match/chat ที่เชื่อถือได้:** Cloud Functions สร้าง match และ notifications, pagination, read state, block/report และตรวจการเข้าถึงทุก conversation
5. **สื่อและ safety:** upload ที่ตรวจขนาด/ชนิด, report/moderation queue, consent และ privacy/data-retention policy
6. **ปิดระบบเก่า:** หยุด public routes/socket, rotate secrets, ถอด MongoDB/demo fallback หลังเทียบข้อมูลครบ
7. **ปล่อยมือถือ:** Android internal track, iOS TestFlight; สร้าง native build/sign บนเครื่อง CI ที่เหมาะสม; ทดสอบคนละบัญชีและคนละเครือข่าย
8. **ดูแล production:** monitoring/crash reporting, App Check, abuse limits, backup/restore drill, user deletion workflow และ incident response

## สถานะงานในรอบนี้

- เพิ่ม bootstrap Firebase แบบใช้ค่ากำหนดตอน build แยก app ID ของ Android/iOS/Web
- เพิ่ม flow สมัคร/ล็อกอินด้วย KKU email, verification email, โปรไฟล์, swipe/mutual match, รายการ match และ Firestore chat ใน Flutter
- เพิ่ม Firestore/Storage Rules และ composite index ตัวเริ่มต้น; เจ้าของข้อมูลและสมาชิก match ถูกจำกัดด้วย rules
- ตั้ง application ID Android/iOS เป็น `com.kkudating.app` และชื่อแอป KKU Dating
- เพิ่ม Firebase Hosting rewrite เพื่อให้ Flutter Web ใช้ route เดียวกับมือถือ; เอกสาร setup/build และแผน migration พร้อมแล้ว แต่ Firebase project จริงยังต้องสร้าง/เพิ่ม app IDs และ deploy
- ยังไม่ได้ migrate เว็บเดโม, ตั้งค่า Firebase project ของจริง, เพิ่ม Cloud Functions/admin UI/voice call หรือทดสอบ build iOS บน Xcode
