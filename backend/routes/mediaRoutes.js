/**
 * Media Routes — REST API
 * POST /api/media/upload — อัปโหลดรูปหรือวิดีโอ 3 วินาที
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { process3SecVideoClip } = require('../services/mediaService');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|mp4|mov|webm/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

router.post('/upload', upload.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const isVideo = file.mimetype.startsWith('video/');

    if (isVideo) {
      const result = await process3SecVideoClip(file.path, path.join(__dirname, '../uploads/'));
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
    console.error('Error uploading media:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
