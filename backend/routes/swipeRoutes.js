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

// Keep an unmatched pair as a tombstone so old mutual swipes cannot recreate the match.
router.delete('/match/:userId/:partnerId', async (req, res) => {
  const { userId, partnerId } = req.params;
  if (!userId || !partnerId || userId === partnerId) {
    return res.status(400).json({ error: 'Valid userId and partnerId are required' });
  }

  const [profile1Id, profile2Id] = [userId, partnerId].sort();
  try {
    if (getIsConnected()) {
      await Match.updateOne(
        { profile1Id, profile2Id },
        { $set: { status: 'unmatched' } },
        { upsert: true }
      );
    } else {
      const existingMatch = memoryMatches.find(match => match.profile1Id === profile1Id && match.profile2Id === profile2Id);
      if (existingMatch) existingMatch.status = 'unmatched';
      else memoryMatches.push({ profile1Id, profile2Id, status: 'unmatched', matchedAt: new Date() });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error unmatching profiles:', err);
    return res.status(500).json({ error: err.message });
  }
});

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
          const p1Id = swiperId < swipedId ? swiperId : swipedId;
          const p2Id = swiperId < swipedId ? swipedId : swiperId;
          const previousMatch = await Match.findOne({ profile1Id: p1Id, profile2Id: p2Id });
          if (previousMatch?.status === 'unmatched') return res.json({ success: true, isMatch: false, unmatched: true });
          try {
            await Match.create({ profile1Id: p1Id, profile2Id: p2Id });
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
          const p1Id = swiperId < swipedId ? swiperId : swipedId;
          const p2Id = swiperId < swipedId ? swipedId : swiperId;
          const previousMatch = memoryMatches.find(m => m.profile1Id === p1Id && m.profile2Id === p2Id);
          if (previousMatch?.status === 'unmatched') return res.json({ success: true, isMatch: false, unmatched: true });
          
          if (!memoryMatches.some(m => m.profile1Id === p1Id && m.profile2Id === p2Id)) {
            memoryMatches.push({ profile1Id: p1Id, profile2Id: p2Id, matchedAt: new Date() });
          }

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
