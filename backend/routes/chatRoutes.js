/**
 * Chat Routes — REST API
 * GET /api/messages/:matchId — ดึงข้อความ
 */
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { getIsConnected } = require('../config/db');
const { memoryMessages } = require('../config/memoryStore');

// ดึงข้อความระหว่างสองคน (Moved above :matchId to fix routing)
router.get('/conversation/:userId1/:userId2', async (req, res) => {
  const { userId1, userId2 } = req.params;
  try {
    if (getIsConnected()) {
      const messages = await Message.find({
        $or: [
          { senderId: userId1, recipientId: userId2 },
          { senderId: userId2, recipientId: userId1 }
        ]
      }).sort({ sentAt: 1 }).limit(100);
      return res.json({ success: true, messages });
    } else {
      const messages = memoryMessages.filter(
        m => (m.senderId === userId1 && m.recipientId === userId2) ||
             (m.senderId === userId2 && m.recipientId === userId1)
      );
      return res.json({ success: true, messages });
    }
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// ดึงข้อความตาม match ID
router.get('/:matchId', async (req, res) => {
  try {
    if (getIsConnected()) {
      const messages = await Message.find({ matchId: req.params.matchId }).sort({ sentAt: 1 }).limit(100);
      return res.json({ success: true, messages });
    } else {
      const messages = memoryMessages.filter(m => m.matchId === req.params.matchId);
      return res.json({ success: true, messages });
    }
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
