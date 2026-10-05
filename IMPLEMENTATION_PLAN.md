# KKU Dating — แผนปรับปรุงก่อนนำไปใช้งานจริง

เอกสารนี้เป็นแผนงานเท่านั้น ยังไม่มีการแก้ไขโค้ดตามรายการด้านล่าง

## เป้าหมาย

1. ให้เฉพาะผู้ที่ยืนยันความเป็นเจ้าของอีเมล `@kkumail.com` ได้เท่านั้นที่เข้าใช้งานได้
2. ให้ API, แชท และฐานข้อมูลทำงานบน cloud ตลอดเวลา โดยไม่ต้องเปิดคอมพิวเตอร์เครื่องพัฒนา
3. แก้ปัญหา API, ความปลอดภัย และโครงสร้างที่ซ้ำซ้อนก่อนเปิดให้ผู้ใช้จริง

## ลำดับความสำคัญ

| ระดับ | งาน |
| --- | --- |
| P0 | รวม backend ให้เหลือชุดเดียว, แก้ route แชท, ป้องกัน Socket.IO ส่งข้อมูลถึงทุกคน |
| P1 | ทำระบบยืนยัน KKU Mail จริง, authorization, persistence ของข้อมูล |
| P2 | Deploy cloud, database managed, object storage, HTTPS และ monitoring |
| P3 | ปรับ upload, voice call, CI/CD และ automated tests |

## ระยะที่ 1 — รวมสถาปัตยกรรมให้ชัดเจน

ปัจจุบันมี backend สองชุดที่ใช้ port `3000` เหมือนกัน:

- `backend/` ใช้ Express, MongoDB/Mongoose และ Socket.IO — ให้เลือกเป็น backend หลัก
- `server/` เป็นชุดเก่าที่ใช้ in-memory data และมีไฟล์ PostgreSQL ปะปน

### ไฟล์ที่ต้องดำเนินการ

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `package.json` | เปลี่ยน scripts ใน root ให้ชี้ไป `backend/` หรือทำเป็น workspace; เอา dependency ที่ไม่ใช้ใน root ออกหลังยืนยันการใช้งาน |
| `README.md` | ปรับวิธีติดตั้ง, run, deploy และ architecture ให้บอก backend ชุดเดียว |
| `server/server.js` | ย้ายออกจากเส้นทาง deploy หรือ archive หลังย้ายสิ่งที่จำเป็นครบ |
| `server/routes/api.js` | ย้าย/เลิกใช้เพื่อไม่ให้มี API ที่ผลลัพธ์ต่างจาก backend หลัก |
| `server/services/mediaService.js` | รวมกับ service ใน `backend/` หรือเลิกใช้ |
| `server/schema.sql` | archive/ลบจาก production scope หากเลือก MongoDB เป็นฐานข้อมูลหลัก |

## ระยะที่ 2 — แก้ปัญหา API และข้อมูล

| ไฟล์ | ปัญหาปัจจุบัน | แผนแก้ |
| --- | --- | --- |
| `backend/routes/chatRoutes.js` | route `/:matchId` อยู่ก่อน `/conversation/:userId1/:userId2` ทำให้เรียก conversation ไม่ได้ | ย้าย route conversation ขึ้นก่อน route parameter ทั่วไป; กำหนด API แชทมาตรฐานเพียงรูปแบบเดียว |
| `backend/models/Message.js` | model มี `matchId` แต่จุดบันทึกข้อความไม่ได้กำหนดค่า | ตัดสินใจใช้ `matchId` หรือคู่ user IDs เป็น key หลัก แล้วบันทึก/ดึงข้อมูลให้สอดคล้องกัน |
| `backend/routes/swipeRoutes.js` | มี demo auto-match และมีโอกาส match ซ้ำ/สลับลำดับคู่ | validate action, ทำ unique match แบบไม่ขึ้นกับลำดับคู่, ทำธุรกรรมหรือ atomic operation |
| `backend/models/Match.js` | unique index กันได้เฉพาะคู่ในลำดับเดิม | canonicalize คู่ user IDs ก่อนบันทึก หรือใช้ compound key ที่เรียงค่าแล้ว |
| `backend/models/Profile.js` | field ยืนยันตัวตน/ข้อมูล social ที่ client ส่งไม่ได้ออกแบบไว้ชัดเจน | เพิ่ม schema ที่จำเป็น หรือแยกข้อมูลส่วนตัวไป model อื่นและห้ามส่งกลับใน public profile |
| `mobile/src/services/api.js` | IP backend ถูก hard-code | รับ API URL จาก environment แยก dev/staging/production |
| `mobile/src/context/AppContext.js` | state แชท/match อยู่ในเครื่องเป็นหลัก และ listener ไม่มี lifecycle ชัดเจน | โหลดข้อมูลจาก API หลัง login, sync จาก server และ cleanup socket listeners ตอน logout/unmount |
| `mobile/src/screens/ExploreScreen.js` | Super Like ถูกแปลงเป็น Like และ client สร้าง demo match เอง | ส่ง action ให้ตรง, ให้ server เป็นผู้ตัดสิน match และให้ client แสดงผลจาก server event |

## ระยะที่ 3 — Login เฉพาะ KKU Mail

### หลักการ

การตรวจเพียง suffix `@kkumail.com` ไม่ยืนยันว่าเป็นเจ้าของอีเมลจริง จึงต้องใช้ KKU SSO/OAuth ที่ได้รับอนุญาต หรือส่ง verification link/OTP ไปยังกล่องอีเมลนั้น

### งานที่ต้องทำ

1. ติดต่อหน่วยงาน IT ของมหาวิทยาลัยเพื่อยืนยันว่ามี KKU SSO/OAuth/OpenID Connect สำหรับระบบภายนอกหรือไม่
2. หากใช้ SSO ได้: ใช้ authorization-code flow และตรวจ issuer, audience, callback URL และ email domain จาก identity provider
3. หากใช้ SSO ไม่ได้: ใช้ email verification link หรือ OTP ที่ส่งได้เฉพาะ `@kkumail.com` ผ่านผู้ให้บริการอีเมลที่ได้รับอนุญาต
4. สร้าง model `User` แยกจาก `Profile` เพื่อเก็บ normalized email, verification status, provider ID, role, suspended status และ timestamps
5. ใช้ access token อายุสั้นและ refresh token ที่ rotate/revoke ได้; ห้ามใช้ token แบบ mock หรือสุ่มข้อความธรรมดา
6. เพิ่ม middleware ตรวจ authentication และ authorization ให้ REST API ทุกจุดที่อ่าน/แก้ข้อมูลส่วนบุคคล
7. Socket.IO ต้องตรวจ token ใน handshake และรับ user ID จาก token เท่านั้น
8. เพิ่ม logout, revoke session, rate limit การขอ OTP, audit log และลบบัญชีตามนโยบาย privacy

### ไฟล์ที่ต้องแก้หรือเพิ่ม

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `backend/routes/authRoutes.js` | แทน mock login ด้วย SSO หรือ email verification; ห้าม auto-approve ทุก KKU email |
| `backend/server.js` | ติดตั้ง auth middleware, trusted CORS origins, rate limiter และ error handler กลาง |
| `backend/socket/socketHandler.js` | authenticate socket handshake; ไม่รับ identity จาก `register_socket_user` โดยไม่มี token |
| `backend/models/User.js` (ใหม่) | เก็บ account, email verification, provider identity, refresh/session metadata และ account status |
| `backend/services/authService.js` (ใหม่) | จัดการ SSO/OTP, token issue/verify/revoke และส่งอีเมล |
| `backend/middleware/auth.js` (ใหม่) | ตรวจ bearer token และกำหนด `req.user` |
| `mobile/src/services/api.js` | แนบ token กับ request และจัดการ refresh/401 |
| `mobile/src/services/socket.js` | ส่ง token ตอนสร้าง Socket.IO connection และ reconnect หลัง refresh token |
| `mobile/src/context/AppContext.js` | restore session อย่างปลอดภัย, logout และ clear state เมื่อ session หมดอายุ |
| `mobile/src/screens/RegisterScreen.js` | เปลี่ยนเป็นหน้า login/verify; สร้าง profile ได้หลังยืนยันสำเร็จเท่านั้น |
| `mobile/src/screens/ProfileScreen.js` | แสดงสถานะ verification จาก server และไม่ให้แก้ email ที่ verify แล้วโดยไม่มี flow ยืนยันใหม่ |

## ระยะที่ 4 — ป้องกันข้อมูลรั่วผ่าน Socket.IO และ API

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `backend/socket/socketHandler.js` | เปลี่ยน `io.emit()` สำหรับ match/chat/WebRTC/call-end เป็นการส่งเฉพาะ room ของผู้รับและผู้ส่ง; ตรวจว่าเป็นสมาชิก match เดียวกันก่อนส่ง |
| `backend/routes/privacyRoutes.js` | ย้าย consent, block และ report จาก memory ไปฐานข้อมูล; ตรวจสิทธิ์คู่ match; แจ้งผลเฉพาะผู้เกี่ยวข้อง |
| `backend/routes/profileRoutes.js` | แยก public profile ออกจาก private account data; validate ขนาด/ชนิดข้อมูลและ enforce owner-only update |
| `backend/routes/mediaRoutes.js` | require authenticated user; ตรวจ file signature ไม่ใช่ MIME/extension อย่างเดียว; จำกัดขนาดและจำนวนไฟล์ |
| `backend/server.js` | จำกัด CORS, เพิ่ม security headers, request size limits ที่เหมาะสม, rate limits และ structured logs |
| `app.js` | ลด/เลิกใช้ `innerHTML` กับข้อมูลผู้ใช้และข้อความแชท; escape ทุกข้อมูลก่อน render เพื่อป้องกัน XSS |
| `index.html` | เพิ่ม Content Security Policy และย้าย inline handlers ไป JavaScript modules หากยังคงเว็บเดโมไว้ |

## ระยะที่ 5 — อัปโหลดสื่อและ Voice Call

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/screens/RegisterScreen.js` | หลังเลือกรูปให้อัปโหลดผ่าน media API แล้วเก็บ URL; ห้ามเก็บ Base64 ขนาดใหญ่ใน AsyncStorage/API JSON |
| `mobile/src/screens/ProfileScreen.js` | ใช้ upload flow เดียวกันและแสดง loading/error/retry |
| `backend/routes/mediaRoutes.js` | ลบ source file หลังแปลง video สำเร็จ/ล้มเหลว, รองรับ cleanup และคืน absolute/public URL ที่ mobile ใช้ได้ |
| `backend/services/mediaService.js` | ตรวจว่ามี FFmpeg ใน production, จำกัด duration และจัดการ job failure/retry |
| `mobile/src/screens/ChatScreen.js` | เปลี่ยน placeholder SDP และ Base64 audio relay เป็น WebRTC จริง หรือปิดฟีเจอร์นี้ใน production จนพร้อม |
| `backend/socket/socketHandler.js` | ใช้ Socket.IO เพียง signaling ของ WebRTC; ห้าม relay audio chunks ผ่าน Socket.IO สำหรับระบบจริง |

WebRTC สำหรับ production ต้องมี STUN/TURN server, token/room authorization, call lifecycle และการทดสอบบน Android/iOS/เครือข่ายมือถือจริง

## ระยะที่ 6 — Deploy ให้ใช้งานโดยไม่ต้องเปิดเครื่องพัฒนา

### สถาปัตยกรรมเป้าหมาย

```text
Mobile App / Web
        |  HTTPS + authenticated Socket.IO
        v
Cloud Backend (Express + Socket.IO, always on)
        |-- Managed MongoDB + backup
        |-- KKU SSO หรือ email verification service
        `-- Object storage สำหรับรูป/วิดีโอ
```

### งาน deploy

1. Deploy `backend/` ไปยัง cloud provider ที่รองรับ long-lived WebSocket และตั้งค่า always-on/restart policy
2. ใช้ MongoDB Atlas หรือ managed MongoDB พร้อม network access rules, backups และแยก production database
3. ใช้ object storage สำหรับ `/uploads` แทน disk ของ server ที่อาจหายเมื่อ redeploy
4. ตั้ง domain สำหรับ API, HTTPS certificate และ CORS ให้ตรง domain ของ web/mobile builds
5. ตั้ง environment secrets บน cloud: `MONGODB_URI`, token secrets, SSO/SMTP credentials, allowed origins และ storage keys
6. เปลี่ยน mobile API config ให้ชี้ domain production แทน LAN IP/localhost
7. ตั้ง health check, centralized logs, alerting, error monitoring และ database backup/restore drill
8. ตั้ง CI/CD เพื่อ deploy หลัง test ผ่าน เพื่อไม่ต้องเปิดคอมพิวเตอร์เครื่องพัฒนา

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `backend/server.js` | รองรับ environment configuration, health/readiness check และ graceful shutdown |
| `backend/.env.example` (ใหม่) | ระบุตัวแปรที่ต้องตั้งโดยไม่ใส่ secret จริง |
| `mobile/src/services/api.js` | เลือก API URL ตาม build environment |
| `mobile/app.json` | เพิ่ม environment/build configuration ตามบริการ build ที่เลือก |
| `.github/workflows/ci.yml` | ตรวจ test/build แล้ว deploy หลังผ่าน; แก้คำสั่ง `kill %1` ให้ใช้ Bash-compatible process cleanup |
| `Dockerfile` (ใหม่) | สร้าง runtime ที่ deterministic พร้อม Node และ FFmpeg หากใช้ container deployment |
| `docker-compose.yml` (ใหม่, สำหรับ local development) | รัน backend + MongoDB ท้องถิ่นโดยไม่ใช้เป็น production deployment |

## ระยะที่ 7 — Test และเกณฑ์ก่อนเปิดใช้จริง

| หมวด | เกณฑ์ผ่าน |
| --- | --- |
| Authentication | อีเมลนอก `@kkumail.com` เข้าไม่ได้; KKU email ที่ไม่ยืนยันเข้าไม่ได้; token หมดอายุถูกปฏิเสธ |
| Authorization | ผู้ใช้ A อ่านแชท/consent/profile private ของ B ไม่ได้; socket ปลอม user ID ไม่ได้ |
| Chat | conversation endpoint คืนข้อมูลถูกคู่และเรียงเวลา; message ไม่ส่งถึง client ที่ไม่เกี่ยวข้อง |
| Match | สร้าง match เพียงครั้งเดียวแม้ swipe ซ้ำหรือเกิดพร้อมกัน |
| Media | ไฟล์ปลอมชนิดถูกปฏิเสธ; ไฟล์ใหญ่เกิน limit ถูกปฏิเสธ; URL ใช้ได้ทั้ง web และ mobile |
| Deployment | restart backend แล้วข้อมูลยังอยู่; health check ผ่าน; HTTPS และ Socket.IO reconnect ได้ |
| CI | lint, unit tests, integration tests, Expo config/build check ต้องผ่านก่อน deploy |

## ลำดับลงมือที่แนะนำ

1. เลือก `backend/` เป็น backend เดียวและแก้ scripts/README
2. แก้ chat route และ Socket.IO room/authorization ก่อนเปิดทดสอบหลายผู้ใช้
3. ตกลงกับ มข. เรื่อง SSO หรือเลือก email verification provider
4. ทำ `User` model, token auth และ middleware ให้ครบ
5. ย้าย state สำคัญจาก mobile memory ไป backend/database
6. ย้าย media ไป object storage และจัดการ upload อย่างปลอดภัย
7. Deploy backend/database/cloud configuration และตั้ง domain/HTTPS
8. เพิ่ม tests/CI/CD, ทดสอบ security และทดสอบการใช้งานจริงก่อนเปิดบริการ
