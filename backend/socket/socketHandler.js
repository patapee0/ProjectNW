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
              const p1Id = swiperId < swipedId ? swiperId : swipedId;
              const p2Id = swiperId < swipedId ? swipedId : swiperId;
              const previousMatch = await Match.findOne({ profile1Id: p1Id, profile2Id: p2Id });
              if (previousMatch?.status === 'unmatched') return;
              isMutualMatch = true;
              try { await Match.create({ profile1Id: p1Id, profile2Id: p2Id }); } catch (e) {}
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
              if (previousMatch?.status === 'unmatched') return;
              isMutualMatch = true;
              if (!memoryMatches.some(m => m.profile1Id === p1Id && m.profile2Id === p2Id)) {
                memoryMatches.push({ profile1Id: p1Id, profile2Id: p2Id, matchedAt: new Date() });
              }
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

    // 📡 Network RTT Ping-Pong latency handler (For Computer Networking Course Inspector)
    socket.on('ping_rtt', (clientTimestamp, callback) => {
      if (typeof callback === 'function') {
        callback({ serverTimestamp: Date.now(), clientTimestamp });
      } else {
        socket.emit('pong_rtt', { serverTimestamp: Date.now(), clientTimestamp });
      }
    });

    // 🎙️ WebRTC Voice Call Signaling Handlers
    const handleOffer = (data) => {
      const { targetId, offer, callerProfile } = data;
      const callerId = socket.profileId || socket.id;
      console.log(`📞 WebRTC Offer: [${callerId}] -> [${targetId}]`);
      io.emit('webrtc_offer_received', {
        callerId,
        targetId,
        offer,
        callerProfile: callerProfile || { name: 'นิสิต มข.', faculty: 'มหาวิทยาลัยขอนแก่น' }
      });
    };

    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc', handleOffer);

    socket.on('webrtc_answer', (data) => {
      const { targetId, answer } = data;
      const responderId = socket.profileId || socket.id;
      console.log(`📞 WebRTC Answer: [${responderId}] -> [${targetId}]`);
      io.emit('webrtc_answer_received', {
        responderId,
        targetId,
        answer
      });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { targetId, candidate } = data;
      const senderId = socket.profileId || socket.id;
      io.emit('webrtc_ice_candidate_received', {
        senderId,
        targetId,
        candidate
      });
    });

    // 🎙️ Full-Duplex Real-Time Voice Audio Stream Relay (Targeted emission with detailed packet logging)
    socket.on('voice_audio_chunk', (data) => {
      const { targetId, audioData } = data;
      const senderId = socket.profileId || socket.id;

      if (!targetId || !audioData) return;

      const payload = {
        senderId,
        targetId,
        audioData
      };

      const byteLength = audioData ? audioData.length : 0;
      console.log(`[SERVER-RELAY] 🎙️ Voice chunk from [${senderId}] -> [${targetId}] (${byteLength} chars)`);

      // If calling demo partner ('p1', 'p2', etc.), loop back to sender for testing
      if (targetId.startsWith('p')) {
        socket.emit('voice_audio_chunk_received', payload);
      } else {
        // Emit specifically to the target user's rooms
        io.to(targetId).to(`user_${targetId}`).emit('voice_audio_chunk_received', payload);
      }
    });

    socket.on('end_voice_call', (data) => {
      const targetId = data ? data.targetId : null;
      const callerId = socket.profileId || socket.id;
      console.log(`📵 Voice Call Ended by: [${callerId}] targeting [${targetId}]`);
      io.emit('voice_call_ended', {
        callerId,
        targetId
      });
    });

    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocketHandlers;
