/**
 * In-Memory Fallback Store
 * Used when MongoDB is not running locally, so the server and app operate seamlessly.
 */
const DEFAULT_DEMO_PROFILES = [
  {
    id: 'p1',
    name: 'น้องแป้ง (Pang)',
    age: 21,
    verified: true,
    faculty: '⚙️ คณะวิศวกรรมศาสตร์',
    bio: 'สายลุย ชอบไปนั่งทำงานหอสมุดกังสดาล 💻 ชวนไปวิ่งบึงสีฐาน หรือหาของกินกังสดาลได้นะ 🍢',
    tags: ['#Engineering', '#Kangsadan', '#CoffeeLover'],
    media: [
      { type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lighting-1230-large.mp4', is3sClip: true },
      { type: 'image', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' }
    ],
    img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
    isDemo: true
  },
  {
    id: 'p2',
    name: 'พี่ไทเกอร์ (Tiger)',
    age: 22,
    verified: true,
    faculty: '🩺 คณะแพทยศาสตร์',
    bio: 'นศ.แพทย์ ขึ้นวอร์ดเหนื่อยๆ หาคนไปนั่งชิวร้านกาแฟหลัง ม. KKU ☕️ เล่นดนตรีได้นิดหน่อย 🎸',
    tags: ['#Medicine', '#Musician', '#ComplexKKU'],
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80' }
    ],
    img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
    isDemo: true
  },
  {
    id: 'p3',
    name: 'พี่มิ้นท์ (Mint)',
    age: 21,
    verified: true,
    faculty: '🎨 คณะศิลปกรรมศาสตร์',
    bio: 'ชอบวาดรูป กินชาเย็น ☕️🎨 หาคนไปเดินตลาดต้นตาลด้วยกัน',
    tags: ['#Art', '#Photography', '#TonTan'],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80' }],
    img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    isDemo: true
  }
];

let memoryProfiles = [...DEFAULT_DEMO_PROFILES];
let memorySwipes = [];
let memoryMatches = [];
let memoryMessages = [];

module.exports = {
  memoryProfiles,
  memorySwipes,
  memoryMatches,
  memoryMessages
};
