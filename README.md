# KKU Dating

โปรเจกต์มี Flutter app สำหรับ Android/iOS และ Flutter Web ที่ใช้หน้าและบริการ Firebase ชุดเดียวกัน เป้าหมายคือให้เว็บและแอปใช้บัญชี ข้อมูลโปรไฟล์ การแมตช์ และข้อความชุดเดียวกันผ่าน Firebase บนอินเทอร์เน็ต ไม่ต้องเปิดเครื่องพัฒนาและไม่ต้องใช้เครือข่าย Wi-Fi เดียวกัน

## โครงสร้างปัจจุบัน

| ส่วน | ที่อยู่ | สถานะ |
| --- | --- | --- |
| เว็บเดโมเดิม | `index.html`, `app.js`, `styles.css` | legacy; ยังเก็บบางข้อมูลใน `localStorage` และเรียก Express API; ไม่แชร์ข้อมูล Firebase |
| Backend เดิม | `backend/` | Express, MongoDB และ Socket.IO; มีข้อมูลจำลอง/หน่วยความจำและยังไม่เหมาะเปิดสาธารณะ |
| แอป Flutter | `kku_dating_flutter/` | เริ่มใช้ Firebase Auth, Firestore และ Storage; มีสมัคร/ยืนยันอีเมล, โปรไฟล์, ค้นพบ, swipe, match และแชท |
| แอป Expo เดิม | `mobile/` | มี Android native project แต่ยังใช้ API ที่ต้องกำหนด URL; ไม่ใช่แอป Flutter |

> **ข้อควรระวัง:** backend ใน `backend/` เป็นเดโมเก่าที่มี mock KKU login และ Socket.IO ที่เชื่อ user ID จาก client จึงถูกปิดการเริ่มทำงานไว้โดยค่าเริ่มต้น และ bind เฉพาะ `127.0.0.1` เมื่อเปิดใช้เพื่อทดลองในเครื่องเท่านั้น ห้ามนำไป deploy หรือใช้กับข้อมูลจริง แอปที่ควรใช้คือ Flutter ใน `kku_dating_flutter/` ซึ่งยืนยันตัวตนและตรวจสิทธิ์ด้วย Firebase

สำหรับเว็บและมือถือที่ใช้ Firebase ร่วมกัน ให้ build Flutter Web ลง Firebase Hosting หรือ build เป็น native Android/iOS จาก `kku_dating_flutter/`; ไม่ต้องเปิด Expo Go ส่วน iOS ต้อง build/sign บนเครื่อง macOS ที่ติดตั้ง Xcode; Windows สร้าง iOS archive ไม่ได้ หน้าเว็บเดิมยังแยกจาก Firebase จนกว่าจะย้ายข้อมูลและเปลี่ยน Hosting ไป Flutter Web

แผนระบบและรายการตรวจพบอยู่ใน [SYSTEM_DESIGN_PLAN_TH.md](SYSTEM_DESIGN_PLAN_TH.md)

## เตรียม Firebase

1. โปรเจกต์คือ `ProjectNetwork` (`projectnetwork-c403e`, project number `994412669909`); ได้ลงทะเบียน Android/iOS/Web apps แล้ว โดย Android/iOS ใช้ `com.kkudating.app` และ Hosting site คือ `projectnetwork-c403e-cf176`
2. เปิด **Authentication → Email/Password**, **Cloud Firestore** และ **Cloud Storage**
3. Deploy `kku_dating_flutter/firestore.rules`, `firestore.indexes.json` และ `storage.rules` ด้วย Firebase CLI จากโฟลเดอร์ `kku_dating_flutter`
4. Web config จาก Firebase Console ถูกตั้งเป็นค่าเริ่มต้นใน `kku_dating_flutter/lib/firebase_options.dart` แล้ว; ใส่ Android หรือ iOS App ID ที่ได้จาก Firebase Console ใน `--dart-define` ตอน build (ค่าพวกนี้เป็น client config ไม่ใช่ service-account key)

ตัวอย่าง PowerShell สำหรับ Android:

```powershell
cd kku_dating_flutter
flutter pub get
flutter run -d android `
  --dart-define=FIREBASE_PROJECT_ID=projectnetwork-c403e `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=994412669909 `
  --dart-define=FIREBASE_ANDROID_APP_ID=<android-app-id> `
  --dart-define=FIREBASE_STORAGE_BUCKET=<storage-bucket>
```

สร้าง Android APK สำหรับติดตั้ง:

```powershell
flutter build apk --release `
  --dart-define=FIREBASE_PROJECT_ID=projectnetwork-c403e `
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=994412669909 `
  --dart-define=FIREBASE_ANDROID_APP_ID=<android-app-id> `
  --dart-define=FIREBASE_STORAGE_BUCKET=<storage-bucket>
```

ตัวอย่าง iOS บน macOS เพิ่ม `FIREBASE_IOS_APP_ID`, `FIREBASE_IOS_BUNDLE_ID=com.kkudating.app` แล้วใช้ `flutter run -d ios` หรือ `flutter build ipa --release` พร้อมค่าชุดเดียวกัน ส่วนเว็บ Flutter เพิ่ม `FIREBASE_WEB_APP_ID` และ `FIREBASE_AUTH_DOMAIN` แล้ว build ด้วย `flutter build web`

Deploy rules และเว็บ Hosting จาก `kku_dating_flutter/` หลัง build เว็บและเข้าสู่ระบบ Firebase CLI ด้วย project `projectnetwork-c403e` ให้ใช้ `firebase.json` ที่มีอยู่แล้ว ไม่ต้องรัน `firebase init`:

```powershell
flutter build web --release
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

สำหรับ Android/iOS ให้เติม App ID ของ platform จาก Firebase Console ใน build ด้วย `--dart-define=FIREBASE_ANDROID_APP_ID=...` หรือ `--dart-define=FIREBASE_IOS_APP_ID=...`; ห้ามใส่ service-account JSON หรือ Admin SDK private key ในแอป/เว็บ

## โครงสร้างข้อมูล Firebase

- `users/{uid}` — โปรไฟล์ที่เปิดแสดงต่อสมาชิกที่ยืนยันอีเมลแล้ว
- `swipes/{swiperUid}_{targetUid}` — การเลือกของผู้ใช้; ใช้ document ID ที่คงที่เพื่อกันข้อมูลซ้ำ
- `matches/{lowerUid}_{higherUid}` — แมตช์และข้อความล่าสุด
- `matches/{matchId}/messages/{messageId}` — บทสนทนาที่สมาชิกในแมตช์อ่าน/ส่งได้
- Firebase Storage `profiles/{uid}/{file}` — รูปภาพของเจ้าของบัญชี

Firestore เปิด cache บนอุปกรณ์ Android/iOS โดย SDK; การยืนยันสิทธิ์, สร้างบัญชี และส่งข้อความต้องต่ออินเทอร์เน็ต ข้อมูลที่ cache ไว้ช่วยให้อ่านข้อมูลที่เคยโหลดได้ แต่ไม่ได้ทำให้การสมัคร/ค้นพบผู้ใช้ใหม่ทำงานแบบออฟไลน์

## ข้อจำกัดก่อนเปิดให้ผู้ใช้จริง

- ยืนยันว่าอีเมลถูกเปิดจากกล่องจดหมายจริง แต่การตรวจโดเมนอย่างเดียวไม่เท่ากับ KKU SSO; ตรวจสอบกับฝ่าย IT มข. ว่ามี identity provider ให้ใช้หรือไม่
- เว็บปัจจุบันยังไม่ได้ย้ายจาก localStorage/API ไปใช้ Firebase Auth และ Firestore จึงยังไม่ sync กับ Flutter จนกว่าจะทำ migration ตามแผน
- ควรย้ายการสร้าง match, การตรวจสิทธิ์/รายงานผู้ใช้, push notification และงาน moderation ไป Cloud Functions พร้อม App Check และ rate limits
- แชทใน Flutter เป็น real-time ด้วย Firestore; voice call, media picker/upload UI, push notifications และ admin console ยังไม่อยู่ในรุ่นนี้
- กฎ Firebase เป็นส่วนบังคับของระบบ: deploy rules ก่อนเปิดข้อมูลให้แอปเชื่อมต่อ

## Backend เดิม (ใช้เพื่ออ้างอิง/ระหว่างย้ายระบบ)

```powershell
npm install
npm run dev
```

Backend นี้ยังใช้ MongoDB/หน่วยความจำและไม่ใช่บริการ cloud ที่พร้อมใช้งานจริงโดยไม่มีการ deploy, TLS, authentication และแก้ authorization/broadcast ตามแผน ห้ามเปิด API นี้สู่อินเทอร์เน็ตสาธารณะในสภาพปัจจุบัน
