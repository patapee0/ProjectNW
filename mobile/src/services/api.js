/**
 * API Service — REST API calls to Backend
 * รองรับทั้ง PC (localhost) และ Mobile (IP: 192.168.1.42)
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// IP ของเครื่องคอมพิวเตอร์ในวง Wi-Fi
const PC_LAN_IP = '192.168.1.42';

function getBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // บน Web Browser ใช้ localhost:3000
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  // บน Mobile (Expo Go): ลองดึง IP จาก Expo Host
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    null;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    if (host && !host.includes('exp.direct') && !host.includes('expo.dev') && host !== 'localhost' && !host.startsWith('127.')) {
      return `http://${host}:3000`;
    }
  }

  // ใช้ IP ของคอมพิวเตอร์ในวง Wi-Fi เดียวกัน
  return `http://${PC_LAN_IP}:3000`;
}

export const API_URL = getBaseUrl();
const BASE_URL = API_URL;

// ดึงโปรไฟล์ทั้งหมด
export async function fetchProfiles() {
  try {
    const res = await fetch(`${BASE_URL}/api/profiles`);
    const data = await res.json();
    if (data.success) {
      return data.profiles;
    }
    return [];
  } catch (err) {
    console.log('API fetchProfiles error:', err.message);
    return [];
  }
}

// ลงทะเบียนโปรไฟล์
export async function registerProfile(profileData) {
  try {
    const res = await fetch(`${BASE_URL}/api/profiles/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.log('API registerProfile error:', err.message);
    return { success: false, error: err.message };
  }
}

// บันทึก swipe action
export async function recordSwipe(swiperId, swipedId, action) {
  try {
    const res = await fetch(`${BASE_URL}/api/swipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swiperId, swipedId, action }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.log('API recordSwipe error:', err.message);
    return { success: false };
  }
}

export async function unmatchProfiles(userId, partnerId) {
  try {
    const res = await fetch(`${BASE_URL}/api/swipes/match/${encodeURIComponent(userId)}/${encodeURIComponent(partnerId)}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err) {
    console.log('API unmatchProfiles error:', err.message);
    return { success: false, error: err.message };
  }
}

// ดึงข้อความแชท
export async function fetchMessages(userId1, userId2) {
  try {
    const res = await fetch(`${BASE_URL}/api/messages/conversation/${userId1}/${userId2}`);
    const data = await res.json();
    if (data.success) {
      return data.messages;
    }
    return [];
  } catch (err) {
    console.log('API fetchMessages error:', err.message);
    return [];
  }
}

// Health check
export async function healthCheck() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    return data;
  } catch (err) {
    return { status: 'offline' };
  }
}

// ยืนยันตัวตน KKU Account (@kkumail.com)
export async function verifyKkuMail(email) {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/kku-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ KKU Auth' };
  }
}

// เชื่อมต่อ Social Media (Enrich Profile)
export async function linkSocialMedia(platform, handle) {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/social-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, handle }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ Social Media' };
  }
}

// ส่งความยินยอมเปิดเผยข้อมูลติดต่อ (Mutual Contact Reveal)
export async function requestRevealConsent(matchId, userId) {
  try {
    const res = await fetch(`${BASE_URL}/api/privacy/reveal-consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, userId }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'ไม่สามารถส่งความยินยอมได้' };
  }
}
