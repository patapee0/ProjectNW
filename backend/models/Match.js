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
  },
  status: {
    type: String,
    enum: ['active', 'unmatched'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true
});

// ป้องกันแมตช์ซ้ำ — เหมือน UNIQUE(profile_1_id, profile_2_id) ใน PostgreSQL
matchSchema.index({ profile1Id: 1, profile2Id: 1 }, { unique: true });

// Ensure profile1Id and profile2Id are always sorted alphabetically to prevent reverse duplicate matches
matchSchema.pre('save', function(next) {
  if (this.profile1Id > this.profile2Id) {
    const temp = this.profile1Id;
    this.profile1Id = this.profile2Id;
    this.profile2Id = temp;
  }
  next();
});

module.exports = mongoose.model('Match', matchSchema);
