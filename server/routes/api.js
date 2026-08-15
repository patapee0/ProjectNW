/**
 * KKU Dating REST API Routes
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { process3SecVideoClip } = require('../services/mediaService');

// Multer storage configuration for uploads
const upload = multer({ dest: 'uploads/' });

/**
 * GET /api/cards
 * Fetch recommended profiles for swiping feed
 */
router.get('/cards', async (req, res) => {
  try {
    // In production, query database profiles excluding already swiped IDs
    res.json({
      success: true,
      data: [
        {
          id: 'p1',
          name: 'น้องแป้ง',
          age: 21,
          faculty: 'คณะวิศวกรรมศาสตร์',
          bio: 'ชวนไปวิ่งบึงสีฐานได้นะ',
          media: [
            { type: 'video', url: '/uploads/pang_3s.mp4', duration: 3.0 }
          ]
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/swipes
 * Record like/dislike action and evaluate match logic
 */
router.post('/swipes', async (req, res) => {
  const { swiperId, swipedId, action } = req.body;

  try {
    // 1. Record Swipe in Database
    // SQL: INSERT INTO swipes (swiper_id, swiped_id, action) VALUES ($1, $2, $3)
    
    // 2. Check if reverse like exists (Mutual Like Check)
    // SQL: SELECT * FROM swipes WHERE swiper_id = $2 AND swiped_id = $1 AND action IN ('like','superlike')
    const isMutualMatch = (action === 'like' || action === 'superlike'); // Simulated match check

    if (isMutualMatch) {
      // Create match record
      // SQL: INSERT INTO matches (profile_1_id, profile_2_id) VALUES ($1, $2)
      return res.json({
        success: true,
        isMatch: true,
        matchData: {
          matchId: 'm_generated_id',
          matchedAt: new Date()
        }
      });
    }

    res.json({ success: true, isMatch: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/media/upload
 * Upload photo or 3-second short video clip
 */
router.post('/media/upload', upload.single('mediaFile'), async (req, res) => {
  try {
    const file = req.file;
    const isVideo = file.mimetype.startsWith('video/');

    if (isVideo) {
      // Process & clip video to max 3 seconds
      const result = await process3SecVideoClip(file.path, 'uploads/');
      return res.json({
        success: true,
        mediaType: 'video',
        url: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        duration: result.duration
      });
    }

    res.json({
      success: true,
      mediaType: 'image',
      url: `/uploads/${file.filename}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
