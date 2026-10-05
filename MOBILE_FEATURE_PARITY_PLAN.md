# KKU Dating — แผนทำให้ Mobile ใช้งานได้เทียบเท่าเว็บบนคอมพิวเตอร์

เอกสารนี้เป็นแผนงานสำหรับ React Native/Expo ใน `mobile/` เพื่อให้ผู้ใช้โทรศัพท์ใช้งานฟีเจอร์หลักได้ครบและให้ผลลัพธ์ตรงกับเว็บใน `index.html` และ `app.js` โดยยังไม่มีการแก้โค้ดตามเอกสารนี้

## ขอบเขตและเป้าหมาย

เป้าหมายคือให้ iOS, Android และ Expo Web ใช้ backend เดียวกัน ข้อมูลตรงกัน และรองรับฟีเจอร์เหล่านี้:

1. Login/ยืนยัน KKU Mail, สร้างบัญชี, แก้ไขโปรไฟล์ และเชื่อม social account
2. Browse profile, swipe/pass/like/super-like, rewind และสลับรูปหรือวิดีโอ
3. Match, รายการ match, แชทแบบ real-time, โหลดประวัติ และสถานะอ่านข้อความ
4. การขอ/ยินยอมเปิดเผยข้อมูลติดต่อแบบ mutual consent
5. Report/block และการไม่แสดงคู่ที่ block แล้ว
6. Network status/debug view เฉพาะ development/admin
7. Voice call ที่ทำงานจริงหรือแสดงสถานะว่าเป็น demo อย่างตรงไปตรงมา
8. ทำงานได้บนโทรศัพท์จริง, เครือข่ายมือถือ, Wi-Fi และหลังปิด/เปิดแอปใหม่

## หลักการก่อนทำ Feature Parity

- Backend ต้องเป็น source of truth; mobile และ web ห้ามตัดสิน match, สิทธิ์ หรือการเปิดเผยข้อมูลกันเอง
- API response, socket event และ data model ต้องมี contract เดียวสำหรับทุก client
- แยกฟีเจอร์สำหรับผู้ใช้จริงออกจาก Network Inspector/ข้อมูล debug ที่ไม่ควรแสดงบน production
- ทุกฟีเจอร์ต้องมี loading, error, empty, offline และ retry state บนมือถือ
- ใช้ URL แบบ HTTPS production และห้ามอ้างอิง `localhost` หรือ LAN IP ตายตัวใน build ที่แจกผู้ใช้

## ตารางเปรียบเทียบฟีเจอร์

| ฟีเจอร์ | เว็บปัจจุบัน | Mobile ปัจจุบัน | แผนทำให้เท่ากัน |
| --- | --- | --- | --- |
| Register/Profile | มี form, KKU mock, social, รูป | มี form และรูป แต่ข้อมูลบางส่วนไม่ persist ที่ server | ใช้ auth/profile API ชุดเดียว, รอผลจาก server และเก็บ session อย่างปลอดภัย |
| Swipe | drag card, pass/like/super, rewind, media carousel | มี gesture/ปุ่ม แต่ super ถูกส่งเป็น like และ match demo ถูกสร้างฝั่ง client | normalize action, server เป็นผู้แจ้ง match, ทำ card state ให้ recover หลัง restart |
| Match/Chat | modal match, chat, simulated demo reply | มี match/chat แต่ยังพึ่ง local state และไม่ได้โหลด conversation เสมอ | sync matches/messages จาก server, notification และ unread count |
| Contact reveal | มีปุ่มขอ consent | มีปุ่ม แต่ไม่ subscribe ผล mutual reveal | เพิ่ม reveal state, real-time update, display ข้อมูลหลังทั้งคู่ยินยอม |
| Report/block | API อยู่ backend แต่ web/mobile ไม่ครบ flow | ไม่มี UI flow | เพิ่ม menu, reason picker, confirmation และ update feed/matches |
| Upload video | เว็บมี UI/route รองรับแนวคิด clip 3 วินาที | Mobile เลือกรูปเท่านั้น | เพิ่ม video picker/upload/progress/playback และ backend validation |
| Network inspector | มีหน้า network/backend dashboard | ไม่มี | ทำเฉพาะ dev/admin screen หรือเอาออกจาก parity ของ end user |
| Voice call | มี WebRTC UI แต่ fallback simulation | Mobile มี SDP/audio-chunk simulation | ทำ WebRTC จริงทั้งสอง platform หรือ disable/label demo จนกว่าระบบพร้อม |

## ระยะที่ 1 — กำหนด API และข้อมูลกลาง

### งานที่ต้องทำ

1. เขียน API contract สำหรับ auth, profile, discovery, swipes, matches, conversation, media, privacy และ block/report
2. กำหนด schema กลางสำหรับ `User`, `Profile`, `Match`, `Message`, `Media`, `Consent` และ `Block` พร้อม field ที่ client ใช้จริง
3. ระบุรูปแบบ error เดียวกัน เช่น `{ success, code, message, data }`
4. ระบุ socket events พร้อม payload, ผู้รับ, acknowledgement และ reconnection behavior
5. เพิ่ม API ที่ mobile ต้องใช้แต่ยังขาด: list matches, discovery ที่ตัดคน swipe/block ออก, conversation history, unread/read state และ reveal status

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `backend/routes/profileRoutes.js` | เพิ่ม owner-only profile update และ discovery query ที่ pagination ได้ |
| `backend/routes/swipeRoutes.js` | ให้ response/event จาก server เป็นแหล่งผล swipe และ match เดียว |
| `backend/routes/chatRoutes.js` | แก้ลำดับ route และเพิ่ม conversation history, pagination, read receipt |
| `backend/routes/privacyRoutes.js` | เพิ่ม reveal status, block/report persistence และ authorization |
| `backend/routes/mediaRoutes.js` | ให้ response คืน public absolute URL และ metadata ที่ mobile ใช้ render ได้ |
| `backend/socket/socketHandler.js` | กำหนด targeted rooms, authenticated events, acknowledgement และ reconnect sync |
| `mobile/src/services/api.js` | สร้าง typed/centralized API functions ตาม contract เดียว |
| `mobile/src/services/socket.js` | รวม socket listeners, auth handshake, subscribe/unsubscribe และ reconnect policy |

## ระยะที่ 2 — Authentication และ Session บนโทรศัพท์

### ผลลัพธ์ที่ต้องได้

- เปิดแอปครั้งแรกเห็น login/verify screen
- login สำเร็จแล้วปิดและเปิดแอปใหม่ยังอยู่ใน session อย่างปลอดภัย
- token หมดอายุ refresh ได้ หรือพากลับไป login อย่างชัดเจน
- logout ลบ session, disconnect socket และล้างข้อมูล private ในเครื่อง

### ไฟล์ที่ต้องแก้หรือเพิ่ม

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/screens/RegisterScreen.js` | เปลี่ยนจากการสร้าง profile local เป็น flow login/verify KKU Mail, loading/retry/error และสร้าง profile หลังยืนยันเท่านั้น |
| `mobile/src/context/AppContext.js` | แยก `session`, `currentUser`, `myProfile`, initial hydration และ logout cleanup |
| `mobile/src/services/api.js` | แนบ access token, refresh token, intercept 401 และใช้ production API URL |
| `mobile/src/services/socket.js` | สร้าง connection หลัง session ready และ disconnect เมื่อ logout |
| `mobile/src/services/secureStorage.js` (ใหม่) | เก็บ token ใน secure storage ที่รองรับ iOS/Android; ไม่ใช้ AsyncStorage สำหรับ secret |
| `mobile/App.js` | ใส่ boot/loading gate เพื่อรอ session restore ก่อน render navigation |

## ระยะที่ 3 — Swipe และ Feed ให้เท่าเว็บ

### รายการพฤติกรรม

- โหลด feed แบบ pagination และ refresh ได้
- ไม่แสดงตัวเอง, คนที่ swipe แล้ว หรือคนที่ block กัน
- รองรับ pass, like, super-like และ rewind ตาม business rule เดียวกับเว็บ
- แสดงรูปหลายรูป/วิดีโอ, indicator และ fallback เมื่อ media โหลดไม่ได้
- ป้องกันผู้ใช้กดซ้ำระหว่างกำลังส่ง swipe
- ถ้าสัญญาณขาด ให้ queue อย่างปลอดภัยหรือแจ้ง retry; ห้ามแสดงว่า match สำเร็จก่อน server ยืนยัน

### ไฟล์ที่ต้องแก้หรือเพิ่ม

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/screens/ExploreScreen.js` | แก้ super-like action, รอ API/socket acknowledgement, เพิ่ม loading/empty/error, media carousel และ accessibility labels |
| `mobile/src/context/AppContext.js` | เก็บ feed cursor, swipe history, pending actions และ refresh state |
| `mobile/src/services/api.js` | เพิ่ม `fetchDiscovery`, `recordSwipe`, `rewindSwipe` และ pagination support |
| `mobile/src/components/ProfileMediaCarousel.js` (ใหม่) | รวม image/video rendering, pagination indicator, play/pause lifecycle และ placeholder |
| `mobile/src/components/SwipeCard.js` (ใหม่) | แยก gesture/animation/overlay ให้ทดสอบและบำรุงรักษาง่าย |
| `backend/routes/swipeRoutes.js` | validate action, idempotency และคืน match result ที่เชื่อถือได้ |

## ระยะที่ 4 — Match, Chat และ Notification

### ผลลัพธ์ที่ต้องได้

- match ใหม่ปรากฏบนทุกอุปกรณ์ของเจ้าของบัญชี
- เปิดแชทแล้วโหลดข้อความเก่าแบบ pagination และได้ข้อความใหม่แบบ real-time
- ไม่เห็น/รับข้อความของผู้ใช้ที่ไม่เกี่ยวข้อง
- มี last message, timestamp, unread count และ read receipt ตาม API ที่กำหนด
- เมื่อ app อยู่ background ใช้ push notification แทนการพึ่ง socket ที่อาจถูก OS หยุด

### ไฟล์ที่ต้องแก้หรือเพิ่ม

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/screens/MatchesScreen.js` | โหลด match list จาก server, แสดง empty/loading/error และ unread state |
| `mobile/src/screens/ChatScreen.js` | โหลด conversation, send ด้วย acknowledgement/retry, pagination, read receipt และ cleanup listeners เมื่อออกจากหน้า |
| `mobile/src/context/AppContext.js` | sync match/message state จาก API และ socket โดยไม่ duplicate |
| `mobile/src/services/api.js` | เพิ่ม fetch matches, fetch conversation, mark read และ report/block calls |
| `mobile/src/services/socket.js` | subscribe เฉพาะ event ของ current user/match และทำ deduplication ด้วย message ID |
| `mobile/src/services/notifications.js` (ใหม่) | จัดการ permission, push token และ deep link เข้าห้องแชท |
| `backend/socket/socketHandler.js` | ส่ง match/message เฉพาะ room ของผู้รับและผู้ส่ง; ห้ามใช้ global broadcast |
| `backend/routes/chatRoutes.js` | แก้ conversation route, pagination, authorization และ message ownership |

## ระยะที่ 5 — Profile, Media, Privacy และ Safety

### Profile และ media

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/screens/ProfileScreen.js` | โหลด profile server-side, save แบบ optimistic ที่ rollback ได้, แสดง verification status และ session controls |
| `mobile/src/screens/RegisterScreen.js` | เปลี่ยน image Base64 เป็น upload URL flow และเพิ่ม validation ก่อน submit |
| `mobile/src/services/media.js` (ใหม่) | image/video picker, resize/compress, multipart upload, progress, retry และ cancellation |
| `mobile/src/components/ProfileMediaEditor.js` (ใหม่) | เพิ่ม/ลบ/เรียงรูปและวิดีโอ, จำกัดจำนวนและแสดง upload status |
| `backend/routes/mediaRoutes.js` | ตรวจ ownership, file signature, limit, virus scanning policy และ URL ที่ใช้งานจาก mobile ได้ |

### Consent, report และ block

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/screens/ChatScreen.js` | แสดง consent status จริง, subscribe `contact revealed` แบบเฉพาะ match, แสดงข้อมูลติดต่อหลัง mutual consent เท่านั้น |
| `mobile/src/components/SafetyActions.js` (ใหม่) | สร้าง action sheet สำหรับ report/block, เหตุผล, confirmation และ feedback |
| `mobile/src/services/api.js` | เพิ่ม get reveal status, submit consent, report/block |
| `backend/routes/privacyRoutes.js` | persist data, validate requester, hide contact data จน mutual consent และ audit action |
| `mobile/src/context/AppContext.js` | หลัง block ให้ลบ/ซ่อน profile, match และ conversation ตาม policy |

## ระยะที่ 6 — Voice Call

ฟีเจอร์ voice call ปัจจุบันมี UI แต่ยังไม่เทียบเท่าการโทรจริง เพราะ mobile ใช้ SDP placeholder และส่ง audio chunk ผ่าน Socket.IO

### ทางเลือกที่ต้องตัดสินใจก่อน

1. **ทำ WebRTC จริง (แนะนำเมื่อพร้อม production):** ใช้ native WebRTC library, STUN/TURN, signaling ผ่าน authenticated Socket.IO, call permission และ CallKit/ConnectionService ตามความจำเป็น
2. **คงเป็น demo:** ปิดปุ่มใน production หรือแสดงข้อความชัดเจนว่าเป็น simulation ไม่ใช่ private voice call

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/screens/ChatScreen.js` | แยก call state machine: idle, calling, ringing, connected, reconnecting, ended, failed; cleanup microphone/audio ทุกกรณี |
| `mobile/src/services/callService.js` (ใหม่) | ห่อ WebRTC, media permissions, peer connection และ ICE lifecycle |
| `mobile/app.json` | เพิ่ม microphone permission strings และ native configuration ที่จำเป็น |
| `mobile/package.json` | เพิ่ม dependency ที่รองรับ WebRTC ตาม Expo workflow ที่เลือก |
| `backend/socket/socketHandler.js` | signaling เฉพาะคู่ที่ match กัน, ไม่ relay audio data และไม่ broadcast offer/answer/ICE |

## ระยะที่ 7 — Navigation, Design และ Mobile UX

| หัวข้อ | แผนดำเนินการ |
| --- | --- |
| Navigation | ตรวจ deep links จาก push notification, กลับจาก Chat ได้ถูก tab และ reset navigation หลัง logout |
| Safe area | ตรวจทุกหน้าใน iPhone notch/Dynamic Island, Android gesture navigation และ keyboard |
| Keyboard | ทดสอบแชทกับ keyboard บน iOS/Android, scroll-to-latest และ send button ไม่ถูกบัง |
| Loading/offline | ทุกหน้าใช้ skeleton/loading/error/empty state และมี retry button |
| Accessibility | เพิ่ม labels/hints, touch target อย่างน้อย 44px, contrast และรองรับ screen reader |
| Responsive | ทดสอบมือถือจอเล็ก, tablet, landscape และ Expo Web |
| Network inspector | ไม่จำเป็นต้องเป็น tab ผู้ใช้จริง; ย้ายเป็น dev/admin screen ที่เปิดเฉพาะ environment development |

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | แผนดำเนินการ |
| --- | --- |
| `mobile/src/navigation/MainNavigator.js` | เพิ่ม auth stack, protected tabs, deep-link config และ route guards |
| `mobile/App.js` | เพิ่ม error boundary, app bootstrap และ notification/deep-link setup |
| `mobile/src/constants/colors.js` | ตรวจ design tokens และ accessibility contrast ให้ใช้ได้ทั้ง platforms |
| `mobile/src/constants/faculties.js` | เก็บ label/value ที่เป็นมาตรฐานเดียวกับ backend เพื่อไม่ให้ filter/profile ไม่ตรงกัน |

## ระยะที่ 8 — Build และปล่อยบนโทรศัพท์จริง

1. แยก environment: development, staging และ production สำหรับ API URL, Socket URL, OAuth callback และ logging
2. ทดสอบ Expo Go เฉพาะช่วงพัฒนา; สร้าง development build เมื่อมี native modules เช่น WebRTC หรือ notification
3. สร้าง Android App Bundle และ iOS archive ผ่าน EAS Build หรือ pipeline ที่เลือก
4. ตั้ง app identifiers, icons, splash screen, privacy policy URL และ permission descriptions ใน `mobile/app.json`
5. ตั้ง error monitoring, analytics ที่เคารพ privacy และ crash reporting
6. ทดสอบบนอุปกรณ์จริงอย่างน้อย Android และ iPhone รุ่นที่รองรับล่าสุดของโปรเจกต์
7. ส่งผ่าน TestFlight/Google Play internal testing ก่อนเปิด public release

## แผนทดสอบรับรอง Feature Parity

| สถานการณ์ | เกณฑ์ผ่าน |
| --- | --- |
| Login | คนที่ไม่ยืนยัน KKU Mail เข้าไม่ได้; เปิดแอปใหม่แล้วยังมี session ที่ถูกต้อง |
| Multi-device | login บัญชีเดียวบนโทรศัพท์สองเครื่องแล้ว profile/match/message sync ตาม policy |
| Swipe | pass/like/super-like/rewind ให้ผลเหมือน web และไม่มี match ซ้ำ |
| Chat | ข้อความถูกส่งเฉพาะคู่สนทนา, โหลดประวัติได้, reconnect แล้วไม่ซ้ำ/ไม่หาย |
| Media | อัปโหลดรูปและวิดีโอจาก Android/iOS แล้วแสดงได้บน web และ mobile |
| Consent | ข้อมูลติดต่อไม่แสดงจนทั้งสองฝ่ายยินยอม; block/report มีผลทันที |
| Offline | UI แสดงสถานะเหมาะสม, ไม่ทำข้อมูล local/server ขัดแย้ง และ retry ได้ |
| Voice | หากเปิดใช้ ต้องโทรข้าม Android/iOS/เครือข่ายต่างกันได้; หากยังไม่พร้อม ต้องถูกปิดหรือระบุ demo ชัดเจน |
| Security | ผู้ใช้ที่สามรับ Socket event/แชท/สัญญาณสายของคู่อื่นไม่ได้ |
| Release | build ผ่าน Android/iOS, app ไม่ crash ที่ startup, HTTPS และ production API ใช้งานได้ |

## ลำดับลงมือที่แนะนำ

1. ทำ API/socket contract และแก้ authorization/global broadcast บน backend
2. ทำ login/session/secure storage แล้วค่อยเปิด protected navigation
3. ทำ feed/swipe/match โดยให้ server เป็น source of truth
4. ทำ conversation history, real-time chat, unread และ push notification
5. ทำ profile/media/privacy/report/block
6. ตัดสินใจและทำ voice call จริง หรือปิดจาก production
7. ปรับ UX, accessibility, offline/retry และ test devices
8. ทำ build/release pipeline และทดสอบ internal ก่อนปล่อยจริง
