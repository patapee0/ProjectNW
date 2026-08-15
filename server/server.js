/**
 * KKU Dating - Multi-User Real-Time Server with Socket.io
 */
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e7
});

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../')));

// In-Memory Database
let profiles = [
  {
    id: 'p1',
    name: 'น้องแป้ง (Pang)',
    age: 21,
    verified: true,
    faculty: '⚙️ คณะวิศวกรรมศาสตร์',
    bio: 'สายลุย ชอบไปนั่งทำงานหอสมุดกังสดาล 💻 ชวนไปวิ่งบึงสีฐาน หรือหาของกินกังสดาลได้นะ 🍢',
    tags: ['#Engineering', '#Kangsadan', '#CoffeeLover'],
    media: [{ type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lighting-1230-large.mp4', is3sClip: true }]
  },
  {
    id: 'p2',
    name: 'พี่ไทเกอร์ (Tiger)',
    age: 22,
    verified: true,
    faculty: '🩺 คณะแพทยศาสตร์',
    bio: 'นศ.แพทย์ ขึ้นวอร์ดเหนื่อยๆ หาคนไปนั่งชิวร้านกาแฟหลัง ม. KKU ☕️',
    tags: ['#Medicine', '#Musician', '#ComplexKKU'],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80' }]
  }
];

let swipes = []; // { swiperId, swipedId, action, time }
let matches = [];
let messages = {};

// REST APIs
app.get('/api/profiles', (req, res) => {
  res.json({ success: true, profiles });
});

app.post('/api/profiles/register', (req, res) => {
  const { id, name, age, faculty, bio, photoUrl } = req.body;
  if (!name || !faculty) {
    return res.status(400).json({ error: 'Name and Faculty required' });
  }

  const profileId = id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const existingIdx = profiles.findIndex(p => p.id === profileId);

  const newProfile = {
    id: profileId,
    name,
    age: parseInt(age, 10) || 20,
    verified: true,
    faculty,
    bio: bio || 'สวัสดีครับ/ค่ะ นิสิต มข.',
    tags: ['#KKUDating', '#NewStudent'],
    img: photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    media: [
      { type: 'image', url: photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80' }
    ]
  };

  if (existingIdx !== -1) {
    profiles[existingIdx] = newProfile;
  } else {
    profiles.unshift(newProfile);
  }

  console.log(`👤 Registered Profile: ${newProfile.name} [${newProfile.id}]`);
  io.emit('new_profile_registered', newProfile);

  res.json({ success: true, profile: newProfile });
});

// Socket.io Real-Time Event Handlers
io.on('connection', (socket) => {
  console.log(`🔌 Device Connected: ${socket.id}`);

  socket.on('register_socket_user', (profileId) => {
    socket.profileId = profileId;
    console.log(`👤 Profile [${profileId}] bound to Socket [${socket.id}]`);
  });

  // Handle Swipe Action & Strict Mutual Like Match Logic
  socket.on('swipe_action', (data) => {
    const { swiperId, swipedId, action } = data;
    console.log(`👆 Swipe Event: [${swiperId}] --(${action})--> [${swipedId}]`);
    
    // Normalize action ('right', 'like', 'super' all count as a positive swipe)
    const isPositiveSwipe = (action === 'right' || action === 'like' || action === 'super');
    
    swipes.push({ swiperId, swipedId, action, isPositive: isPositiveSwipe, time: new Date() });

    if (isPositiveSwipe) {
      // Check if swipedId has ALREADY swiped positive on swiperId
      const isReverseLiked = swipes.some(s => 
        s.swiperId === swipedId && 
        s.swipedId === swiperId && 
        s.isPositive
      );

      const targetIsDemo = swipedId.startsWith('p'); // Auto-match for demo personas

      if (isReverseLiked || targetIsDemo) {
        console.log(`🎉 MUTUAL MATCH CREATED: [${swiperId}] <---> [${swipedId}]`);

        const p1 = profiles.find(p => p.id === swiperId) || { id: swiperId, name: 'นิสิต มข.' };
        const p2 = profiles.find(p => p.id === swipedId) || { id: swipedId, name: 'นิสิต มข.' };

        const matchPayload = {
          swiperId,
          swipedId,
          p1Profile: p1,
          p2Profile: p2,
          matchedAt: new Date()
        };

        matches.push(matchPayload);

        // Broadcast match event to all connected sockets
        io.emit('match_notification', matchPayload);
      } else {
        console.log(`⏳ Pending mutual swipe from [${swipedId}]... No match yet.`);
      }
    }
  });

  // Real-Time Message Relay
  socket.on('send_chat_message', (data) => {
    const { senderId, recipientId, text } = data;
    const msgObj = {
      senderId,
      recipientId,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    console.log(`💬 Message Relay: [${senderId}] -> [${recipientId}]: "${text}"`);
    io.emit('chat_message_received', { senderId, recipientId, msgObj });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Device Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` 🔥 KKU Dating Multi-User Server is LIVE on port ${PORT} `);
  console.log(`=======================================================`);
});
