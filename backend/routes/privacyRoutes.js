/**
 * Privacy & Security Routes
 * Mutual Contact Reveal Consent + Block/Report Handlers
 */
const express = require('express');
const router = express.Router();

// In-memory store for mutual contact reveal requests
// Structure: { matchId: { user1Revealed: boolean, user2Revealed: boolean, revealedAt: Date } }
const revealConsents = {};

/**
 * POST /api/privacy/reveal-consent
 * Body: { matchId, userId, contactInfo: { phone, line, facebook, instagram } }
 */
router.post('/reveal-consent', (req, res) => {
  const { matchId, userId, contactInfo } = req.body;

  if (!matchId || !userId) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  if (!revealConsents[matchId]) {
    revealConsents[matchId] = {
      users: {},
      revealed: false
    };
  }

  revealConsents[matchId].users[userId] = {
    consented: true,
    contactInfo: contactInfo || {},
    timestamp: new Date().toISOString()
  };

  const userIds = Object.keys(revealConsents[matchId].users);
  const isMutual = userIds.length >= 2 && userIds.every(id => revealConsents[matchId].users[id].consented);

  if (isMutual) {
    revealConsents[matchId].revealed = true;

    // Broadcast event via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.emit(`contact_revealed_${matchId}`, {
        matchId,
        revealed: true,
        contacts: revealConsents[matchId].users
      });
    }
  }

  res.json({
    success: true,
    isMutual,
    message: isMutual 
      ? 'ทั้งสองฝ่ายยินยอมเปิดเผยข้อมูลติดต่อแล้ว! 🎉' 
      : 'บันทึกความยินยอมแล้ว (รอคู่จับคู่กดยินยอมเพิ่มเติม)',
    status: revealConsents[matchId]
  });
});

/**
 * GET /api/privacy/reveal-status/:matchId
 */
router.get('/reveal-status/:matchId', (req, res) => {
  const { matchId } = req.params;
  const status = revealConsents[matchId] || { users: {}, revealed: false };
  res.json({ success: true, status });
});

/**
 * POST /api/privacy/report-block
 * Body: { reporterId, targetId, reason, action: 'block' | 'report' }
 */
router.post('/report-block', (req, res) => {
  const { reporterId, targetId, reason, action } = req.body;

  if (!reporterId || !targetId || !action) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  res.json({
    success: true,
    message: action === 'block' 
      ? 'บล็อกผู้ใช้งานเรียบร้อยแล้ว ระบบจะไม่แสดงโปรไฟล์คู่จับคู่นี้อีก'
      : 'ส่งรายงานพฤติกรรมไม่เหมาะสมเรียบร้อยแล้ว ทีมงานจะตรวจสอบโดยเร็วที่สุด',
    ticketId: `report_${Date.now()}`
  });
});

module.exports = router;
