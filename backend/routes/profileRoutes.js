/**
 * Profile Routes — REST API
 * GET  /api/profiles         — ดึงโปรไฟล์ทั้งหมด
 * POST /api/profiles/register — สร้าง/อัปเดตโปรไฟล์
 */
const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const { getIsConnected } = require('../config/db');
const { memoryProfiles } = require('../config/memoryStore');

// ดึงโปรไฟล์ทั้งหมด
router.get('/', async (req, res) => {
  try {
    if (getIsConnected()) {
      const profiles = await Profile.find().sort({ createdAt: -1 });
      const formatted = profiles.map(p => ({
        id: p.profileId,
        name: p.name,
        age: p.age,
        verified: p.isVerified,
        faculty: p.faculty,
        bio: p.bio,
        img: p.photoUrl,
        tags: p.tags,
        media: p.media.length > 0 ? p.media : [{ type: 'image', url: p.photoUrl }],
        isDemo: p.isDemo
      }));
      return res.json({ success: true, profiles: formatted });
    } else {
      // In-memory fallback
      return res.json({ success: true, profiles: memoryProfiles });
    }
  } catch (err) {
    console.error('Error fetching profiles, fallback to memoryStore:', err.message);
    res.json({ success: true, profiles: memoryProfiles });
  }
});

// สร้าง/อัปเดตโปรไฟล์
router.post('/register', async (req, res) => {
  const { id, name, age, faculty, bio, photoUrl } = req.body;

  if (!name || !faculty) {
    return res.status(400).json({ error: 'Name and Faculty required' });
  }

  const profileId = id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const photo = photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

  const formatted = {
    id: profileId,
    name,
    age: parseInt(age, 10) || 20,
    verified: true,
    faculty,
    bio: bio || 'สวัสดีครับ/ค่ะ นิสิต มข.',
    img: photo,
    tags: ['#KKUDating', '#NewStudent'],
    media: [{ type: 'image', url: photo }]
  };

  try {
    if (getIsConnected()) {
      const updateData = {
        name,
        age: parseInt(age, 10) || 20,
        faculty,
        bio: bio || 'สวัสดีครับ/ค่ะ นิสิต มข.',
        photoUrl: photo,
      };
      
      const newMedia = [{ type: 'image', url: photo }];

      await Profile.findOneAndUpdate(
        { profileId },
        { 
          $set: updateData,
          $setOnInsert: {
             tags: ['#KKUDating', '#NewStudent'],
             isVerified: true,
             media: newMedia
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      // Memory store fallback
      const idx = memoryProfiles.findIndex(p => p.id === profileId);
      if (idx !== -1) {
        memoryProfiles[idx] = formatted;
      } else {
        memoryProfiles.unshift(formatted);
      }
    }

    console.log(`👤 Registered Profile: ${formatted.name} [${formatted.id}]`);

    // Broadcast new profile via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('new_profile_registered', formatted);
    }

    res.json({ success: true, profile: formatted });
  } catch (err) {
    console.error('Error registering profile:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
