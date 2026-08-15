/**
 * Swipe Routes — REST API
 * POST /api/swipes — บันทึก swipe action + ตรวจ mutual match
 */
const express = require('express');
const router = express.Router();
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const { getIsConnected } = require('../config/db');
const { memorySwipes, memoryMatches } = require('../config/memoryStore');

router.post('/', async (req, res) => {
  const { swiperId, swipedId, action } = req.body;

  if (!swiperId || !swipedId || !action) {
    return res.status(400).json({ error: 'swiperId, swipedId, and action are required' });
  }

  const isPositive = ['like', 'superlike', 'right', 'super'].includes(action);

  try {
    if (getIsConnected()) {
      await Swipe.findOneAndUpdate(
        { swiperId, swipedId },
        { swiperId, swipedId, action, isPositive },
        { upsert: true, new: true }
      );

      if (isPositive) {
        const reverseSwipe = await Swipe.findOne({ swiperId: swipedId, swipedId: swiperId, isPositive: true });
        const targetIsDemo = swipedId.startsWith('p');

        if (reverseSwipe || targetIsDemo) {
          try {
            await Match.create({ profile1Id: swiperId, profile2Id: swipedId });
          } catch (dupErr) {}

          return res.json({
            success: true,
            isMatch: true,
            matchData: { swiperId, swipedId, matchedAt: new Date() }
          });
        }
      }
    } else {
      // Memory store fallback
      memorySwipes.push({ swiperId, swipedId, action, isPositive, time: new Date() });

      if (isPositive) {
        const reverseSwipe = memorySwipes.some(s => s.swiperId === swipedId && s.swipedId === swiperId && s.isPositive);
        const targetIsDemo = swipedId.startsWith('p');

        if (reverseSwipe || targetIsDemo) {
          memoryMatches.push({ profile1Id: swiperId, profile2Id: swipedId, matchedAt: new Date() });
          return res.json({
            success: true,
            isMatch: true,
            matchData: { swiperId, swipedId, matchedAt: new Date() }
          });
        }
      }
    }

    res.json({ success: true, isMatch: false });
  } catch (err) {
    console.error('Error recording swipe:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
