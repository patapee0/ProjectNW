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

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
