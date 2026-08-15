# 💖 KKU Dating (แอปหาคู่มหาวิทยาลัยขอนแก่น) — v2.0

**KKU Dating** เป็นแอปพลิเคชันหาคู่ออนไลน์สำหรับนักศึกษาและศิษย์เก่ามหาวิทยาลัยขอนแก่น (มข.)

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend (Mobile)** | React Native (Expo) |
| **Backend** | Node.js + Express |
| **Database** | MongoDB (Mongoose ODM) |
| **Real-time** | Socket.IO |
| **Source Control** | GitHub + CI/CD (GitHub Actions) |

---

## 🌟 ฟีเจอร์หลัก

1. **ระบบปัดโปรไฟล์ (Tinder-style Swiping)** — ลาก/ปัดการ์ดด้วย Gesture
2. **รองรับวิดีโอสั้น 3 วินาที** — Auto-loop video preview
3. **ระบบแจ้งเตือนแมตช์** — "It's a Match!" popup ทันที
4. **ระบบแชทเรียลไทม์** — ส่งข้อความโต้ตอบผ่าน Socket.IO
5. **หน้าแก้ไขโปรไฟล์** — เปลี่ยนชื่อ, คณะ, Bio
6. **Multi-device** — เล่นพร้อมกันหลายเครื่องผ่าน Wi-Fi เดียวกัน

---

## 📁 โครงสร้างโปรเจกต์

```
project network/
├── backend/                    # Node.js + Express + MongoDB
│   ├── server.js               # Express + Socket.IO server
│   ├── config/db.js            # Mongoose connection
│   ├── models/                 # Mongoose schemas
│   │   ├── Profile.js
│   │   ├── Swipe.js
│   │   ├── Match.js
│   │   └── Message.js
│   ├── routes/                 # REST API endpoints
│   │   ├── profileRoutes.js
│   │   ├── swipeRoutes.js
│   │   ├── chatRoutes.js
│   │   └── mediaRoutes.js
│   ├── socket/socketHandler.js # Socket.IO events
│   ├── services/mediaService.js
│   └── seed.js                 # Demo data seeder
│
├── mobile/                     # React Native (Expo)
│   ├── App.js                  # Entry point
│   └── src/
│       ├── screens/            # 5 หน้าจอ
│       │   ├── ExploreScreen.js
│       │   ├── MatchesScreen.js
│       │   ├── ChatScreen.js
│       │   ├── ProfileScreen.js
│       │   └── RegisterScreen.js
│       ├── navigation/
│       ├── context/AppContext.js
│       ├── services/           # API + Socket client
│       └── constants/          # Colors, Faculties
│
├── .github/workflows/ci.yml   # GitHub Actions CI
└── README.md
```

---

## 🚀 วิธีการเปิดใช้งาน

### 1. ติดตั้ง MongoDB
```bash
# macOS (Homebrew)
brew install mongodb-community@7.0
brew services start mongodb-community

# Windows — ดาวน์โหลดจาก https://www.mongodb.com/try/download/community
# หรือใช้ MongoDB Atlas (free tier): https://cloud.mongodb.com
```

### 2. รัน Backend Server
```bash
cd backend
npm install
node seed.js          # เพิ่มข้อมูล demo profiles
node server.js        # รัน API server ที่ port 3000
```

### 3. รัน Mobile App
```bash
cd mobile
npm install
npx expo start        # เปิด Expo dev server
```
- สแกน QR Code ด้วย **Expo Go** (iOS/Android) เพื่อเปิดแอปบนมือถือจริง
- หรือกด **w** เพื่อเปิดใน Web Browser

### 4. เชื่อมต่อหลายเครื่อง
- เชื่อมต่อ Wi-Fi เดียวกัน
- แก้ไข `mobile/src/services/api.js` → เปลี่ยน `BASE_URL` เป็น IP ของเครื่อง backend
- เปิด Expo Go บนมือถืออีกเครื่อง → สแกน QR → เล่นพร้อมกันได้!

---

## 🗄️ MongoDB Schema

| Collection | Description |
|-----------|-------------|
| `profiles` | ข้อมูลโปรไฟล์ (ชื่อ, อายุ, คณะ, Bio, รูป, วิดีโอ) |
| `swipes` | ประวัติการปัด (like/dislike/superlike) |
| `matches` | คู่ที่แมตช์กัน (mutual likes) |
| `messages` | ข้อความแชท |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles` | ดึงโปรไฟล์ทั้งหมด |
| POST | `/api/profiles/register` | สร้าง/อัปเดตโปรไฟล์ |
| POST | `/api/swipes` | บันทึก swipe + ตรวจ match |
| GET | `/api/messages/:matchId` | ดึงข้อความแชท |
| POST | `/api/media/upload` | อัปโหลดรูป/วิดีโอ |
| GET | `/api/health` | Health check |

---

## ⚡ Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `swipe_action` | Client → Server | ส่ง swipe action |
| `match_notification` | Server → Client | แจ้งเตือนแมตช์ |
| `send_chat_message` | Client → Server | ส่งข้อความ |
| `chat_message_received` | Server → Client | รับข้อความ |
| `new_profile_registered` | Server → Client | โปรไฟล์ใหม่ลงทะเบียน |

---

## 👨‍💻 พัฒนาโดย

นักศึกษามหาวิทยาลัยขอนแก่น — วิชา Computer Network Project
