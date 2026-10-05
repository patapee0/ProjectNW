/**
 * KKU Dating — Main Server
 * Node.js + Express + MongoDB (Mongoose) + Socket.IO
 */
require('dotenv').config();

// This legacy Express/Socket.IO backend uses mock KKU authentication and
// accepts client-supplied user IDs. It is not the production Firebase app.
// Exit before opening any HTTP/Socket.IO handles unless explicitly opted in.
if (process.env.ENABLE_UNSAFE_LEGACY_DEMO !== 'true') {
  console.error('Legacy demo backend is disabled. Use kku_dating_flutter for the Firebase app.');
  console.error('For isolated local coursework only, opt in with ENABLE_UNSAFE_LEGACY_DEMO=true.');
  process.exit(1);
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const setupSocketHandlers = require('./socket/socketHandler');

// Import Routes
const profileRoutes = require('./routes/profileRoutes');
const swipeRoutes = require('./routes/swipeRoutes');
const chatRoutes = require('./routes/chatRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const authRoutes = require('./routes/authRoutes');
const privacyRoutes = require('./routes/privacyRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e7
});

app.set('io', io);

const PORT = process.env.PORT || 3000;

// Network Traffic Metrics Collector (For Computer Networking Inspection)
let totalRequestCount = 0;
const startTime = Date.now();

app.use((req, res, next) => {
  totalRequestCount++;
  next();
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve static web app assets (styles.css, app.js) from root folder
app.use(express.static(path.join(__dirname, '../')));

// Serve Web App (index.html) at /web
app.get('/web', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Root API Dashboard Endpoint
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KKU Dating Backend API Server</title>
      <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Kanit', sans-serif; }
        body { background-color: #0F172A; color: #F8FAFC; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: #1E293B; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 32px; width: 100%; max-width: 580px; box-shadow: 0 20px 30px rgba(0,0,0,0.5); text-align: center; }
        .logo { width: 64px; height: 64px; background: linear-gradient(135deg, #A51C30, #8B0000); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px; border: 2px solid #FFD700; }
        h1 { font-size: 1.8rem; color: #FFD700; margin-bottom: 6px; }
        p.subtitle { color: #94A3B8; font-size: 0.95rem; margin-bottom: 24px; }
        .status-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(16,185,129,0.15); border: 1px solid #10B981; color: #34D399; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 0.9rem; margin-bottom: 24px; }
        .pulse { width: 8px; height: 8px; background: #10B981; border-radius: 50%; }
        .stack-box { background: rgba(255,255,255,0.05); border-radius: 14px; padding: 16px; margin-bottom: 24px; text-align: left; }
        .stack-title { font-size: 0.85rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .stack-item { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 6px; }
        .stack-item:last-child { margin-bottom: 0; }
        .val { color: #A7F3D0; font-family: monospace; }
        .btn-group { display: flex; flex-direction: column; gap: 10px; }
        .btn-row { display: flex; gap: 10px; }
        .btn { flex: 1; background: linear-gradient(135deg, #A51C30, #8B0000); color: white; text-decoration: none; padding: 12px; border-radius: 30px; font-weight: 600; font-size: 0.95rem; transition: transform 0.2s; display: block; text-align: center; }
        .btn:hover { transform: scale(1.02); }
        .btn-sec { background: rgba(255,255,255,0.1); color: white; }
        .btn-web { background: linear-gradient(135deg, #2563EB, #1D4ED8); border: 1px solid #60A5FA; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">💖</div>
        <h1>KKU Dating API & Server</h1>
        <p class="subtitle">ระบบหลังบ้าน Node.js + Express + MongoDB + Socket.IO (v2.0)</p>
        <div class="status-badge">
          <div class="pulse"></div> Server Status: ONLINE (Port 3000)
        </div>
        <div class="stack-box">
          <div class="stack-title">⚙️ Server Architecture</div>
          <div class="stack-item"><span>Frontend Mobile</span><span class="val">React Native (Expo)</span></div>
          <div class="stack-item"><span>Backend API</span><span class="val">Node.js / Express</span></div>
          <div class="stack-item"><span>Database</span><span class="val">MongoDB (Mongoose)</span></div>
          <div class="stack-item"><span>Real-time Engine</span><span class="val">Socket.IO</span></div>
        </div>
        <div class="btn-group">
          <a href="/web" class="btn btn-web">🌐 เปิดใช้งานหน้าเว็บ (Web Interactive Demo)</a>
          <div class="btn-row">
            <a href="/api/health" class="btn btn-sec" target="_blank">🔍 API Health Check</a>
            <a href="/api/profiles" class="btn btn-sec" target="_blank">👤 View Profiles API</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Network Inspector API Endpoint for Networking Course Presentation
app.get('/api/network/stats', (req, res) => {
  const connectedSockets = io.sockets.sockets.size;
  const connectedClients = Array.from(io.sockets.sockets.values()).map(s => ({
    id: s.id,
    profileId: s.profileId || 'Anonymous',
    ip: s.handshake.address,
    transport: s.conn.transport.name,
    connectedAt: new Date(s.handshake.time).toLocaleTimeString()
  }));

  res.json({
    success: true,
    serverUptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    totalRequestsHandled: totalRequestCount,
    activeSocketConnections: connectedSockets,
    protocols: {
      restApi: 'HTTP/1.1 (TCP)',
      realtimeChat: 'WebSocket (Full-Duplex TCP)',
      voiceCall: 'WebRTC P2P (UDP Stream via STUN/ICE)'
    },
    activeClients: connectedClients,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint (before API routes)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'KKU Dating Backend',
    version: '2.0.0',
    techStack: 'Node.js + Express + MongoDB + Socket.IO',
    timestamp: new Date().toISOString()
  });
});

// REST API Routes
app.use('/api/profiles', profileRoutes);
app.use('/api/swipes', swipeRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/privacy', privacyRoutes);

// Setup Socket.IO Real-Time Handlers
setupSocketHandlers(io);

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Start Server
async function startServer() {
  // เชื่อมต่อ MongoDB
  await connectDB();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use by another process.`);
      console.error(`💡 Tip: Close the other server or kill process using port ${PORT}`);
    } else {
      console.error('❌ Server error:', err.message);
    }
  });

  // The mock backend must remain loopback-only even when explicitly enabled.
  server.listen(PORT, '127.0.0.1', () => {
    console.log('=======================================================');
    console.log(` 🔥 KKU Dating Backend Server is LIVE!`);
    console.log(` 📍 http://localhost:${PORT}`);
    console.log(` 📦 Tech Stack: Express + MongoDB + Socket.IO`);
    console.log(` 🔗 API Health: http://localhost:${PORT}/api/health`);
    console.log('=======================================================');
  });
}

startServer();
