/**
 * Match Model — Mongoose Schema
 * แทน matches table ใน PostgreSQL
 */
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  profile1Id: {
    type: String,
    required: true,
    index: true
  },
  profile2Id: {
    type: String,
    required: true,
    index: true
  },
  matchedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ป้องกันแมตช์ซ้ำ — เหมือน UNIQUE(profile_1_id, profile_2_id) ใน PostgreSQL
matchSchema.index({ profile1Id: 1, profile2Id: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);
