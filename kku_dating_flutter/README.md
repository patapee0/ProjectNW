# KKU Dating — Flutter + Firebase

แอป Flutter ชุดเดียวใช้ได้บนเว็บและ Android โดย Firebase เป็น backend ร่วมกัน

## ข้อมูลใน Firebase

- Firebase Authentication เก็บบัญชีและ credential สำหรับสมัคร/เข้าสู่ระบบ แอปยอมรับเฉพาะ `@kkumail.com` และต้องยืนยันอีเมลก่อนเข้าใช้ข้อมูล
- Cloud Firestore เก็บโปรไฟล์และ preference ที่ `users/{uid}`, ช่องทางติดต่อส่วนตัวที่ `privateProfiles/{uid}`, การปัดที่ `swipes`, คู่แมตช์/ข้อความที่ `matches`, การบล็อก/รายงาน และข้อมูลสัญญาณเสียงที่ `calls`
- Cloudinary เก็บรูปโปรไฟล์ ส่วน URL และ public ID ของรูปที่ใช้อยู่บันทึกใน `users/{uid}`
- Matching ปัจจุบันคำนวณในแอปจากความสนใจ คณะที่เลือก และช่วงอายุ ไม่ใช่บริการ backend แยกต่างหาก
- Facebook/Instagram เป็น URL ที่ผู้ใช้กรอกเองและเก็บเป็นข้อมูลส่วนตัว ยังไม่มี OAuth หรือการดึงข้อมูลอัตโนมัติจาก Meta

## ตั้งค่า Firebase ก่อนทดลอง

1. ใน Firebase Console เปิด Email/Password, สร้าง Firestore และใช้กฎจาก `firestore.rules` พร้อม index จาก `firestore.indexes.json`
2. อัปโหลดรูปผ่าน Cloudinary ด้วย unsigned preset `kku_profile_upload`; ไม่ต้องเปิด Firebase Storage หรือเปลี่ยนแพ็กเกจเป็น Blaze
3. เผยแพร่กฎและ index จาก Firebase CLI หลังเข้าสู่ระบบและเลือกโปรเจกต์:

   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes --project projectnetwork-c403e
   ```

## รันบน PC

เปิด Chrome/Edge จากโฟลเดอร์นี้:

```powershell
flutter run -d chrome
```

สำหรับเว็บที่เปิดจากที่ใดก็ได้ ต้อง build แล้ว deploy Hosting:

```powershell
flutter build web
firebase deploy --only hosting --project projectnetwork-c403e
```

Hosting ใช้ `build/web` และ Firebase site `projectnetwork-c403e-cf176` ตาม `firebase.json`

## รัน/สร้าง Android

ไฟล์ Firebase Android config อยู่ที่ `android/app/google-services.json` และ Android application ID คือ `com.kkudating.app`

```powershell
flutter run
flutter build apk --debug
```

APK สำหรับติดตั้งทดสอบอยู่ที่ `build/app/outputs/flutter-apk/app-debug.apk`

## โทรด้วยเสียง

ใช้ WebRTC และ Firestore สำหรับ signaling ต้องให้อีกฝ่ายเปิดแอป/เว็บและออนไลน์เพื่อรับสาย เว็บต้องเปิดผ่าน HTTPS เพื่ออนุญาตไมโครโฟน หากต้องการให้เชื่อมต่อได้ในเครือข่ายที่ NAT/firewall เข้มงวด ให้ตั้งค่า `TURN_CREDENTIALS_ENDPOINT` ตอน build โดย endpoint ต้องตรวจ Firebase ID token และส่ง `{ "iceServers": [...] }` ที่มี TURN username/credential อายุสั้นกลับมา ห้ามใส่ TURN secret แบบถาวรใน client app

ขณะนี้ค่าเริ่มต้นใช้ STUN อย่างเดียว จึงโทรได้เฉพาะเครือข่ายที่เจรจาเส้นทางตรงกันได้ การเชื่อมต่อผ่านทุกเครือข่ายต้องมี TURN relay; ให้เปิดใช้เฉพาะเมื่อมีโควตาฟรีที่ยืนยันแล้ว เพราะปริมาณ relay ที่เกินโควตาอาจมีค่าใช้จ่าย

## ความปลอดภัยและการจับคู่

- ปัดซ้าย/ขวาหรือใช้ปุ่มเพื่อบันทึก pass/like; เมื่อทั้งสองฝ่าย like จึงสร้าง match และเริ่มแชทได้
- บล็อกจะยกเลิก match และลบข้อความ/ประวัติสายของคู่นั้น ส่วนรายงานถูกบันทึกใน `reports` สำหรับผู้ดูแลตรวจจาก Firebase Console
- อีเมล KKU และลิงก์โซเชียลเก็บใน `privateProfiles` และแสดงได้หลังสมาชิกทั้งคู่กดยินยอม สามารถถอนความยินยอมได้
- การกรอก Facebook/Instagram เป็นเพียงการระบุลิงก์ ไม่ได้ยืนยันว่าเป็นเจ้าของบัญชี; การเชื่อม OAuth จริงต้องลงทะเบียนแอปและตั้งค่ากับ Meta เพิ่มเติม
- ไม่เปิดเผยอีเมลหรือข้อมูลติดต่อจากหน้าค้นพบ และไม่ใช้ social profile API โดยอัตโนมัติ

## ลบบัญชีและข้อมูล (ไม่ใช้ Firebase Blaze)

จากหน้าโปรไฟล์ เลือก **ลบบัญชีและข้อมูลทั้งหมด** แล้วยืนยันด้วยรหัสผ่าน ระบบจะซ่อนโปรไฟล์ก่อน ลบข้อมูลย่อยในสายโทร/ข้อความ รวมถึง matches, calls, swipes และโปรไฟล์ แล้วจึงลบบัญชี Firebase Authentication ขั้นตอนนี้ต้อง deploy `firestore.rules` ใหม่ก่อน และจะหยุดพร้อมข้อความให้ลองใหม่หากมีขั้นตอนไหนผิดพลาด

การลบรูป Cloudinary อัตโนมัติต้องใช้ Cloudflare Worker (Free) เพราะห้ามนำ Cloudinary API secret ไปไว้ในเว็บ/แอป:

1. เปิด PowerShell แล้วเข้าโฟลเดอร์ Worker: `cd turn-worker`; ติดตั้งและล็อกอินด้วย `npm install` และ `npx wrangler login`
2. ตั้ง secrets ทีละตัวด้วย `npx wrangler secret put CLOUDINARY_CLOUD_NAME`, `npx wrangler secret put CLOUDINARY_API_KEY` และ `npx wrangler secret put CLOUDINARY_API_SECRET` แล้วกรอกค่าใน prompt (ห้ามส่ง API secret ในแชตหรือเก็บใน repo)
3. Deploy Worker ด้วย `npx wrangler deploy`; Cloudflare Free จำกัด request ตามโควตาประจำวันของแพ็กเกจ
4. จากโฟลเดอร์ `kku_dating_flutter` build เว็บด้วย `flutter build web --release --dart-define=ACCOUNT_ASSETS_ENDPOINT=https://<worker-host>/delete-profile-image` แล้ว deploy Hosting ด้วย `firebase deploy --only hosting --project projectnetwork-c403e`

หากยังไม่ได้ตั้ง Worker ระบบจะลบบัญชีและข้อมูล Firebase แต่รูปที่อัปโหลดก่อนหน้านี้อาจยังอยู่ใน Cloudinary Media Library ให้ลบรายการนั้นด้วยตนเอง รูปที่อัปโหลดใหม่จะจัดเก็บ public ID แยกตาม UID เพื่อให้ Worker ตรวจสิทธิ์ก่อนลบได้

ตัวอย่างคำสั่ง build หลังติดตั้ง TURN credential endpoint แล้ว:

```powershell
flutter build web --dart-define=TURN_CREDENTIALS_ENDPOINT=https://YOUR-WORKER-URL/turn-credentials
```

หากไม่ได้กำหนด endpoint แอปจะใช้ STUN เท่านั้น จึงไม่รับประกันการเชื่อมต่อผ่านทุกเครือข่าย
