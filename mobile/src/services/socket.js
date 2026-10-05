/**
 * Socket.IO Client Service — Real-time communication
 */
import { io } from 'socket.io-client';
import { API_URL } from './api';

let socket = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;

  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
  });

  socket.on('connect', () => {
    console.log('⚡️ Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });

  socket.on('connect_error', (err) => {
    console.log('Socket connection error:', err.message);
  });

  return socket;
}

export function getSocket() {
  if (!socket) {
    return connectSocket();
  }
  return socket;
}

export function registerSocketUser(profileId) {
  const s = getSocket();
  s.emit('register_socket_user', profileId);
}

export function emitSwipeAction(swiperId, swipedId, action) {
  const s = getSocket();
  s.emit('swipe_action', { swiperId, swipedId, action });
}

export function emitChatMessage(senderId, recipientId, text) {
  const s = getSocket();
  s.emit('send_chat_message', { senderId, recipientId, text });
}

export function onMatchNotification(callback) {
  const s = getSocket();
  s.off('match_notification');
  s.on('match_notification', callback);
}

export function onChatMessageReceived(callback) {
  const s = getSocket();
  s.off('chat_message_received');
  s.on('chat_message_received', callback);
}

export function onNewProfileRegistered(callback) {
  const s = getSocket();
  s.off('new_profile_registered');
  s.on('new_profile_registered', callback);
}

// 🎙️ WebRTC Voice Call Signaling Functions
export function emitWebRTCOffer(targetId, offer, callerProfile) {
  const s = getSocket();
  s.emit('webrtc_offer', { targetId, offer, callerProfile });
}

export function emitWebRTCAnswer(targetId, answer) {
  const s = getSocket();
  s.emit('webrtc_answer', { targetId, answer });
}

export function emitICECandidate(targetId, candidate) {
  const s = getSocket();
  s.emit('webrtc_ice_candidate', { targetId, candidate });
}

export function emitEndVoiceCall(targetId) {
  const s = getSocket();
  s.emit('end_voice_call', { targetId });
}

export function onWebRTCOffer(callback) {
  const s = getSocket();
  s.off('webrtc_offer_received');
  s.on('webrtc_offer_received', callback);
}

export function onWebRTCAnswer(callback) {
  const s = getSocket();
  s.off('webrtc_answer_received');
  s.on('webrtc_answer_received', callback);
}

export function onICECandidate(callback) {
  const s = getSocket();
  s.off('webrtc_ice_candidate_received');
  s.on('webrtc_ice_candidate_received', callback);
}

export function onVoiceCallEnded(callback) {
  const s = getSocket();
  s.off('voice_call_ended');
  s.on('voice_call_ended', callback);
}

export function emitVoiceAudioChunk(targetId, audioData) {
  const s = getSocket();
  s.emit('voice_audio_chunk', { targetId, audioData });
}

export function onVoiceAudioChunkReceived(callback) {
  const s = getSocket();
  s.off('voice_audio_chunk_received');
  s.on('voice_audio_chunk_received', callback);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
