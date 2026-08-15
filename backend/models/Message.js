/**
 * Message Model — Mongoose Schema
 * แทน messages table ใน PostgreSQL
 */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    index: true
  },
  recipientId: {
    type: String,
    required: true,
    index: true
  },
  matchId: {
    type: String,
    index: true
  },
  text: {
    type: String,
    required: true
  },
  mediaUrl: String,
  isRead: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index สำหรับดึงข้อความตาม match เรียงตามเวลา
messageSchema.index({ matchId: 1, sentAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
