/**
 * Seed Script — เพิ่มข้อมูล Demo Profiles ลง MongoDB
 * รัน: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Profile = require('./models/Profile');

const DEMO_PROFILES = [
  {
    profileId: 'p1',
    name: 'น้องแป้ง (Pang)',
    age: 21,
    faculty: '⚙️ คณะวิศวกรรมศาสตร์',
    bio: 'สายลุย ชอบไปนั่งทำงานหอสมุดกังสดาล 💻 ชวนไปวิ่งบึงสีฐาน หรือหาของกินกังสดาลได้นะ 🍢',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    tags: ['#Engineering', '#Kangsadan', '#CoffeeLover'],
    media: [
      { type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lighting-1230-large.mp4', is3sClip: true },
      { type: 'image', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' }
    ],
    isVerified: true,
    isDemo: true
  },
  {
    profileId: 'p2',
    name: 'พี่ไทเกอร์ (Tiger)',
    age: 22,
    faculty: '🩺 คณะแพทยศาสตร์',
    bio: 'นศ.แพทย์ ขึ้นวอร์ดเหนื่อยๆ หาคนไปนั่งชิวร้านกาแฟหลัง ม. KKU ☕️ เล่นดนตรีได้นิดหน่อย 🎸',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
    tags: ['#Medicine', '#Musician', '#ComplexKKU'],
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80' },
      { type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-playing-guitar-under-a-tree-41549-large.mp4', is3sClip: true }
    ],
    isVerified: true,
    isDemo: true
  },
  {
    profileId: 'p3',
    name: 'พี่มิ้นท์ (Mint)',
    age: 21,
    faculty: '🎨 คณะศิลปกรรมศาสตร์',
    bio: 'ชอบวาดรูป กินชาเย็น ☕️🎨 หาคนไปเดินตลาดต้นตาลด้วยกัน ชอบถ่ายรูป IG: @mint_art',
    photoUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    tags: ['#Art', '#Photography', '#TonTan'],
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80' }
    ],
    isVerified: true,
    isDemo: true
  },
  {
    profileId: 'p4',
    name: 'น้องเจมส์ (James)',
    age: 20,
    faculty: '💼 คณะบริหารธุรกิจและการบัญชี',
    bio: 'ชอบเล่นกีฬา ⚽️ ทำกิจกรรมชมรมอาสาพัฒนา ชวนไปเตะบอลสนาม มข. ได้นะ!',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    tags: ['#Business', '#Sports', '#Volunteer'],
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80' }
    ],
    isVerified: true,
    isDemo: true
  },
  {
    profileId: 'p5',
    name: 'พี่ฝ้าย (Fai)',
    age: 23,
    faculty: '🧬 คณะวิทยาศาสตร์',
    bio: 'เด็กแลป 🔬 ชอบดูหนัง Netflix แนวไซไฟ หาคนไปกินหมูกระทะหลัง มข. 🍖',
    photoUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=800&q=80',
    tags: ['#Science', '#Netflix', '#Foodie'],
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=800&q=80' }
    ],
    isVerified: true,
    isDemo: true
  }
];

async function seedDatabase() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kku-dating';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB for seeding');

    // ลบ demo profiles เดิม
    await Profile.deleteMany({ isDemo: true });
    console.log('🗑️  Cleared existing demo profiles');

    // เพิ่ม demo profiles ใหม่
    await Profile.insertMany(DEMO_PROFILES);
    console.log(`✅ Seeded ${DEMO_PROFILES.length} demo profiles successfully!`);

    // แสดงรายชื่อ
    DEMO_PROFILES.forEach(p => {
      console.log(`   - ${p.name} (${p.faculty})`);
    });

    await mongoose.disconnect();
    console.log('✅ Database seeding complete!');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seedDatabase();
