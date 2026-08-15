/**
 * AppContext — Global State Management
 * จัดการ myProfile, matches, chatMessages, profiles
 * แทน localStorage ของ Web เดิม ใช้ AsyncStorage
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchProfiles } from '../services/api';
import {
  connectSocket,
  registerSocketUser,
  onMatchNotification,
  onChatMessageReceived,
  onNewProfileRegistered,
} from '../services/socket';

const AppContext = createContext();

const STORAGE_KEYS = {
  MY_PROFILE: 'kku_dating_my_profile',
  MATCHES: 'kku_dating_matches',
  MESSAGES: 'kku_dating_messages',
};

// Default demo profiles (fallback เมื่อ server offline)
const DEFAULT_PROFILES = [
  {
    id: 'p1', name: 'น้องแป้ง (Pang)', age: 21, verified: true,
    faculty: '⚙️ คณะวิศวกรรมศาสตร์',
    bio: 'สายลุย ชอบไปนั่งทำงานหอสมุดกังสดาล 💻 ชวนไปวิ่งบึงสีฐานได้นะ 🍢',
    tags: ['#Engineering', '#Kangsadan', '#CoffeeLover'],
    media: [
      { type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lighting-1230-large.mp4', is3sClip: true },
      { type: 'image', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' }
    ],
    img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'p2', name: 'พี่ไทเกอร์ (Tiger)', age: 22, verified: true,
    faculty: '🩺 คณะแพทยศาสตร์',
    bio: 'นศ.แพทย์ หาคนไปนั่งชิวร้านกาแฟหลัง ม. KKU ☕️',
    tags: ['#Medicine', '#Musician', '#ComplexKKU'],
    media: [{ type: 'image', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80' }],
    img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80'
  },
];

export function AppProvider({ children }) {
  const [myProfile, setMyProfile] = useState(null);
  const [profiles, setProfiles] = useState(DEFAULT_PROFILES);
  const [matches, setMatches] = useState([]);
  const [chatMessages, setChatMessages] = useState({});
  const [cardIndex, setCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // โหลด state จาก AsyncStorage
  useEffect(() => {
    loadState();
  }, []);

  // เมื่อมี profile แล้ว — connect socket + ดึง profiles จาก server
  useEffect(() => {
    if (myProfile) {
      connectSocket();
      registerSocketUser(myProfile.id);
      loadServerProfiles();
      setupSocketListeners();
    }
  }, [myProfile]);

  async function loadState() {
    try {
      const [savedProfile, savedMatches, savedMessages] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.MY_PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.MATCHES),
        AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
      ]);

      if (savedProfile) setMyProfile(JSON.parse(savedProfile));
      if (savedMatches) setMatches(JSON.parse(savedMatches));
      if (savedMessages) setChatMessages(JSON.parse(savedMessages));
    } catch (err) {
      console.error('Error loading state:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveState(profile, matchList, msgs) {
    try {
      const promises = [];
      if (profile !== undefined) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.MY_PROFILE, JSON.stringify(profile)));
      }
      if (matchList !== undefined) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matchList)));
      }
      if (msgs !== undefined) {
        promises.push(AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(msgs)));
      }
      await Promise.all(promises);
    } catch (err) {
      console.error('Error saving state:', err);
    }
  }

  async function loadServerProfiles() {
    const serverProfiles = await fetchProfiles();
    if (serverProfiles.length > 0) {
      const otherProfiles = serverProfiles.filter(p => !myProfile || p.id !== myProfile.id);
      setProfiles([...otherProfiles, ...DEFAULT_PROFILES.filter(dp =>
        !otherProfiles.find(sp => sp.id === dp.id)
      )]);
      setCardIndex(0);
    }
  }

  function setupSocketListeners() {
    // Match notification
    onMatchNotification((data) => {
      const { swiperId, swipedId, p1Profile, p2Profile } = data;
      if (!myProfile) return;

      if (swiperId === myProfile.id || swipedId === myProfile.id) {
        const partnerProfile = (swiperId === myProfile.id) ? p2Profile : p1Profile;
        if (!partnerProfile) return;

        setMatches(prev => {
          const exists = prev.find(m => m.profileId === partnerProfile.id);
          if (exists) return prev;

          const newMatch = {
            id: `m_${partnerProfile.id}`,
            profileId: partnerProfile.id,
            name: partnerProfile.name,
            faculty: partnerProfile.faculty,
            img: partnerProfile.img || (partnerProfile.media && partnerProfile.media[0] ? partnerProfile.media[0].url : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'),
            lastMsg: 'แมตช์ใหม่! เริ่มคุยกันได้เลย 🎉',
            time: 'เมื่อสักครู่',
          };

          const updated = [newMatch, ...prev];
          saveState(undefined, updated, undefined);
          return updated;
        });

        setChatMessages(prev => {
          const matchId = `m_${partnerProfile.id}`;
          if (prev[matchId]) return prev;
          const updated = {
            ...prev,
            [matchId]: [{ sender: 'them', text: 'สวัสดีค่ะ! นศ. มข. เหมือนกันเลย ยินดีที่ได้รู้จักนะคะ 👋' }]
          };
          saveState(undefined, undefined, updated);
          return updated;
        });
      }
    });

    // Chat messages
    onChatMessageReceived((data) => {
      const { senderId, recipientId, msgObj } = data;
      if (!myProfile) return;

      const isMeSender = senderId === myProfile.id;
      const isMeRecipient = recipientId === myProfile.id;
      if (!isMeSender && !isMeRecipient) return;

      const partnerId = isMeSender ? recipientId : senderId;

      setMatches(prev => {
        let match = prev.find(m => m.profileId === partnerId);
        if (!match) return prev;

        const updated = prev.map(m => {
          if (m.profileId === partnerId) {
            return {
              ...m,
              lastMsg: isMeSender ? `คุณ: ${msgObj.text}` : msgObj.text,
              time: msgObj.time || 'เมื่อสักครู่',
            };
          }
          return m;
        });
        saveState(undefined, updated, undefined);
        return updated;
      });

      setChatMessages(prev => {
        const matchId = `m_${partnerId}`;
        const existing = prev[matchId] || [];
        const isDup = existing.some(
          m => m.text === msgObj.text && m.time === msgObj.time && m.sender === (isMeSender ? 'me' : 'them')
        );
        if (isDup) return prev;

        const updated = {
          ...prev,
          [matchId]: [...existing, { sender: isMeSender ? 'me' : 'them', text: msgObj.text }]
        };
        saveState(undefined, undefined, updated);
        return updated;
      });
    });

    // New profile registered
    onNewProfileRegistered((newProfile) => {
      if (myProfile && newProfile.id === myProfile.id) return;
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === newProfile.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = newProfile;
          return updated;
        }
        return [newProfile, ...prev];
      });
      setCardIndex(0);
    });
  }

  // Update profile
  async function updateMyProfile(profile) {
    setMyProfile(profile);
    await saveState(profile, undefined, undefined);
  }

  // Add match manually
  function addMatch(match) {
    setMatches(prev => {
      const updated = [match, ...prev];
      saveState(undefined, updated, undefined);
      return updated;
    });
  }

  // Add message
  function addMessage(matchId, message) {
    setChatMessages(prev => {
      const existing = prev[matchId] || [];
      const updated = { ...prev, [matchId]: [...existing, message] };
      saveState(undefined, undefined, updated);
      return updated;
    });
  }

  // Reset all data
  async function resetAllData() {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.MY_PROFILE,
      STORAGE_KEYS.MATCHES,
      STORAGE_KEYS.MESSAGES,
    ]);
    setMyProfile(null);
    setMatches([]);
    setChatMessages({});
    setCardIndex(0);
  }

  const value = {
    myProfile, setMyProfile: updateMyProfile,
    profiles, setProfiles,
    matches, setMatches, addMatch,
    chatMessages, setChatMessages, addMessage,
    cardIndex, setCardIndex,
    isLoading,
    resetAllData,
    loadServerProfiles,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

export default AppContext;
