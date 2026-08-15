/**
 * Socket.IO Event Handler — Real-Time Communication
 * จัดการ swipe_action, send_chat_message, match_notification
 * รองรับทั้ง MongoDB และ In-Memory Store Fallback
 */
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Profile = require('../models/Profile');
const { getIsConnected } = require('../config/db');
const { memoryProfiles, memorySwipes, memoryMatches, memoryMessages } = require('../config/memoryStore');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Device Connected: ${socket.id}`);

    socket.on('register_socket_user', (profileId) => {
      socket.profileId = profileId;
      socket.join(`user_${profileId}`);
      console.log(`👤 Profile [${profileId}] bound to Socket [${socket.id}]`);
    });

    // Handle Swipe Action & Mutual Match
    socket.on('swipe_action', async (data) => {
      const { swiperId, swipedId, action } = data;
      console.log(`👆 Swipe: [${swiperId}] --(${action})--> [${swipedId}]`);

      const isPositive = ['right', 'like', 'super', 'superlike'].includes(action);

      try {
        let isMutualMatch = false;

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
              isMutualMatch = true;
              try { await Match.create({ profile1Id: swiperId, profile2Id: swipedId }); } catch (e) {}
            }
          }
        } else {
          // Memory store fallback
          memorySwipes.push({ swiperId, swipedId, action, isPositive, time: new Date() });
          if (isPositive) {
            const reverseSwipe = memorySwipes.some(s => s.swiperId === swipedId && s.swipedId === swiperId && s.isPositive);
            const targetIsDemo = swipedId.startsWith('p');
            if (reverseSwipe || targetIsDemo) {
              isMutualMatch = true;
              memoryMatches.push({ profile1Id: swiperId, profile2Id: swipedId, matchedAt: new Date() });
            }
          }
        }

        if (isMutualMatch) {
          console.log(`🎉 MUTUAL MATCH: [${swiperId}] <---> [${swipedId}]`);

          let p1 = null, p2 = null;
          if (getIsConnected()) {
            p1 = await Profile.findOne({ profileId: swiperId });
            p2 = await Profile.findOne({ profileId: swipedId });
          } else {
            p1 = memoryProfiles.find(p => p.id === swiperId || p.profileId === swiperId);
            p2 = memoryProfiles.find(p => p.id === swipedId || p.profileId === swipedId);
          }

          const matchPayload = {
            swiperId,
            swipedId,
            p1Profile: p1 ? {
              id: p1.profileId || p1.id, name: p1.name, faculty: p1.faculty,
              img: p1.photoUrl || p1.img, media: p1.media
            } : { id: swiperId, name: 'นิสิต มข.' },
            p2Profile: p2 ? {
              id: p2.profileId || p2.id, name: p2.name, faculty: p2.faculty,
              img: p2.photoUrl || p2.img, media: p2.media
            } : { id: swipedId, name: 'นิสิต มข.' },
            matchedAt: new Date()
          };

          io.emit('match_notification', matchPayload);
        }
      } catch (err) {
        console.error('Socket swipe error:', err.message);
      }
    });

    // Real-Time Message Relay
    socket.on('send_chat_message', async (data) => {
      const { senderId, recipientId, text } = data;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      console.log(`💬 Message: [${senderId}] -> [${recipientId}]: "${text}"`);

      try {
        if (getIsConnected()) {
          await Message.create({ senderId, recipientId, text, sentAt: new Date() });
        } else {
          memoryMessages.push({ senderId, recipientId, text, time, sentAt: new Date() });
        }

        const msgObj = { senderId, recipientId, text, time };
        io.emit('chat_message_received', { senderId, recipientId, msgObj });
      } catch (err) {
        console.error('Socket message error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocketHandlers;
