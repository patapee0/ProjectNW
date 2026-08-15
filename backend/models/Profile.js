/**
 * Profile Model — Mongoose Schema
 * แทน profiles table ใน PostgreSQL
 */
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  durationSec: {
    type: Number,
    default: 0,
    max: 3.0  // จำกัด 3 วินาทีสำหรับวิดีโอ
  },
  is3sClip: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const profileSchema = new mongoose.Schema({
  profileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    default: 20,
    min: 17,
    max: 30
  },
  faculty: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    default: 'สวัสดีครับ/ค่ะ นิสิต มข.'
  },
  photoUrl: {
    type: String,
    default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  },
  media: [mediaSchema],
  tags: {
    type: [String],
    default: ['#KKUDating']
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  isDemo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true  // createdAt, updatedAt อัตโนมัติ
});

module.exports = mongoose.model('Profile', profileSchema);
