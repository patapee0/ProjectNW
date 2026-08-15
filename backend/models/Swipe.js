/**
 * Swipe Model — Mongoose Schema
 * แทน swipes table ใน PostgreSQL
 */
const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  swiperId: {
    type: String,
    required: true,
    index: true
  },
  swipedId: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['like', 'dislike', 'superlike', 'pass'],
    required: true
  },
  isPositive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ป้องกันการ swipe ซ้ำ — เหมือน UNIQUE(swiper_id, swiped_id) ใน PostgreSQL
swipeSchema.index({ swiperId: 1, swipedId: 1 }, { unique: true });

module.exports = mongoose.model('Swipe', swipeSchema);
