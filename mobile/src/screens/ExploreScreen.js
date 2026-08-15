/**
 * ExploreScreen — หน้าปัดโปรไฟล์ (Tinder-Style Swiping)
 * แทน view-explore ของ Web เดิม
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Animated, PanResponder, Modal, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS, SHADOWS, RADIUS } from '../constants/colors';
import { emitSwipeAction } from '../services/socket';

export default function ExploreScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

  const { myProfile, profiles, cardIndex, setCardIndex, matches, addMatch, chatMessages, setChatMessages, loadServerProfiles } = useApp();
  const [showMatchPopup, setShowMatchPopup] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [mediaIndexes, setMediaIndexes] = useState({});

  const position = useRef(new Animated.ValueXY()).current;

  const validProfiles = profiles.filter(p => !myProfile || p.id !== myProfile.id);
  const currentProfile = validProfiles[cardIndex];

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      position.setValue({ x: gestureState.dx, y: gestureState.dy });
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > SWIPE_THRESHOLD) {
        swipeCard('right');
      } else if (gestureState.dx < -SWIPE_THRESHOLD) {
        swipeCard('left');
      } else if (gestureState.dy < -100) {
        swipeCard('super');
      } else {
        resetPosition();
      }
    },
  });

  function resetPosition() {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 5,
    }).start();
  }

  function swipeCard(direction) {
    const toValue = direction === 'right'
      ? { x: SCREEN_WIDTH + 100, y: 50 }
      : direction === 'left'
        ? { x: -SCREEN_WIDTH - 100, y: 50 }
        : { x: 0, y: -600 };

    Animated.timing(position, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      handleSwipeComplete(direction);
    });
  }

  function handleSwipeComplete(direction) {
    if (!currentProfile || !myProfile) return;

    const action = direction === 'left' ? 'pass' : 'like';

    // Emit swipe via Socket.IO
    emitSwipeAction(myProfile.id, currentProfile.id, action);

    // Check if it should auto-match (demo profiles)
    if (action === 'like' && currentProfile.id.startsWith('p')) {
      handleMatch(currentProfile);
    }

    position.setValue({ x: 0, y: 0 });
    setCardIndex(cardIndex + 1);
  }

  function handleMatch(profile) {
    const imgUrl = profile.img || (profile.media && profile.media[0] ? profile.media[0].url : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80');

    const existing = matches.find(m => m.profileId === profile.id);
    if (!existing) {
      addMatch({
        id: `m_${profile.id}`,
        profileId: profile.id,
        name: profile.name,
        faculty: profile.faculty,
        img: imgUrl,
        lastMsg: 'แมตช์ใหม่! เริ่มคุยกันได้เลย 🎉',
        time: 'เมื่อสักครู่',
      });

      setChatMessages(prev => ({
        ...prev,
        [`m_${profile.id}`]: [
          { sender: 'them', text: 'สวัสดีค่ะ! นศ. มข. เหมือนกันเลย ยินดีที่ได้รู้จักนะคะ 👋' }
        ]
      }));
    }

    setMatchedProfile({ ...profile, img: imgUrl });
    setShowMatchPopup(true);
  }

  function nextMedia(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile || !profile.media) return;
    const currentIdx = mediaIndexes[profileId] || 0;
    setMediaIndexes(prev => ({
      ...prev,
      [profileId]: (currentIdx + 1) % profile.media.length
    }));
  }

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.3],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.3, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const cardStyle = {
    transform: [...position.getTranslateTransform(), { rotate }],
  };

  // Empty state
  if (!currentProfile) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.emptyIcon}>💔</Text>
        <Text style={styles.emptyTitle}>ไม่มีโปรไฟล์เพิ่มเติมแล้ว</Text>
        <Text style={styles.emptySubtitle}>คุณได้ดูโปรไฟล์ทั้งหมดใน มข. แล้ว</Text>
        <TouchableOpacity style={styles.reloadBtn} onPress={() => { setCardIndex(0); loadServerProfiles(); }}>
          <Text style={styles.reloadBtnText}>🔄 รีโหลดหาเพื่อนใหม่</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mediaList = currentProfile.media || [{ type: 'image', url: currentProfile.img }];
  const mediaIdx = mediaIndexes[currentProfile.id] || 0;
  const currentMedia = mediaList[mediaIdx] || mediaList[0];

  return (
    <View style={styles.container}>
      {/* Top Header with Safe Area Insets */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
        <Text style={styles.headerTitle}>KKU Dating 🔥</Text>
        <TouchableOpacity style={styles.headerRefreshBtn} onPress={() => { setCardIndex(0); loadServerProfiles(); }}>
          <Text style={styles.headerRefreshText}>🔄 รีเฟรชหาเพื่อน</Text>
        </TouchableOpacity>
      </View>

      {/* Swipe Card */}
      <View style={styles.cardContainer}>
        <Animated.View style={[styles.card, cardStyle]} {...panResponder.panHandlers}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => nextMedia(currentProfile.id)}
            style={styles.mediaContainer}
          >
            {/* Media indicators */}
            <View style={styles.mediaIndicator}>
              {mediaList.map((_, i) => (
                <View key={i} style={[styles.indicatorBar, i === mediaIdx && styles.indicatorBarActive]} />
              ))}
            </View>

            <Image
              source={{ uri: currentMedia.url || currentProfile.img }}
              style={styles.cardImage}
            />

            {currentMedia.type === 'video' && (
              <View style={styles.videoBadge}>
                <View style={styles.videoPulse} />
                <Text style={styles.videoBadgeText}>3s Short Clip</Text>
              </View>
            )}

            {/* Gradient overlay */}
            <View style={styles.cardOverlay} />
          </TouchableOpacity>

          {/* LIKE badge */}
          <Animated.View style={[styles.badgeLike, { opacity: likeOpacity }]}>
            <Text style={styles.badgeLikeText}>LIKE</Text>
          </Animated.View>

          {/* PASS badge */}
          <Animated.View style={[styles.badgePass, { opacity: passOpacity }]}>
            <Text style={styles.badgePassText}>PASS</Text>
          </Animated.View>

          {/* Card content */}
          <View style={styles.cardContent}>
            <Text style={styles.userName}>{currentProfile.name}, {currentProfile.age || 20} ✓</Text>
            <View style={styles.facultyBadge}>
              <Text style={styles.facultyText}>🎓 {currentProfile.faculty}</Text>
            </View>
            <Text style={styles.userBio} numberOfLines={2}>{currentProfile.bio}</Text>
            <View style={styles.tagsContainer}>
              {(currentProfile.tags || ['#KKUDating']).map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={[styles.actionBtn, styles.rewindBtn]} onPress={() => { if (cardIndex > 0) setCardIndex(cardIndex - 1); }}>
          <Text style={styles.actionIcon}>↩️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={() => swipeCard('left')}>
          <Text style={[styles.actionIcon, { fontSize: 28 }]}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.superBtn]} onPress={() => swipeCard('super')}>
          <Text style={styles.actionIcon}>⭐</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={() => swipeCard('right')}>
          <Text style={[styles.actionIcon, { fontSize: 28 }]}>❤️</Text>
        </TouchableOpacity>
      </View>

      {/* Match Popup Modal */}
      <Modal visible={showMatchPopup} transparent animationType="fade">
        <View style={styles.matchOverlay}>
          <Text style={styles.matchTitle}>IT'S A MATCH! 🎉</Text>
          <Text style={styles.matchSubtitle}>คุณและคู่ของคุณใจตรงกันใน KKU Dating!</Text>
          <View style={styles.matchAvatars}>
            <Image source={{ uri: myProfile?.img }} style={styles.matchAvatar} />
            <Image source={{ uri: matchedProfile?.img }} style={styles.matchAvatar} />
          </View>
          <TouchableOpacity
            style={styles.matchChatBtn}
            onPress={() => {
              setShowMatchPopup(false);
              const match = matches.find(m => m.profileId === matchedProfile?.id) ||
                { id: `m_${matchedProfile?.id}`, profileId: matchedProfile?.id, name: matchedProfile?.name, faculty: matchedProfile?.faculty, img: matchedProfile?.img };
              navigation.navigate('Chat', { match });
            }}
          >
            <Text style={styles.matchChatBtnText}>💬 ส่งข้อความทักเลย</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.matchContinueBtn} onPress={() => setShowMatchPopup(false)}>
            <Text style={styles.matchContinueBtnText}>ปัดหาคนอื่นต่อ</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.accentGold,
  },
  headerRefreshBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  headerRefreshText: {
    color: COLORS.accentGold,
    fontSize: 12,
    fontWeight: '600',
  },
  cardContainer: { flex: 1, padding: 16, paddingTop: 6 },
  card: {
    flex: 1, borderRadius: RADIUS.lg, overflow: 'hidden',
    backgroundColor: COLORS.bgCard, ...SHADOWS.card,
  },
  mediaContainer: { flex: 1 },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  mediaIndicator: {
    position: 'absolute', top: 12, left: 16, right: 16, zIndex: 4,
    flexDirection: 'row', gap: 4,
  },
  indicatorBar: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2,
  },
  indicatorBarActive: { backgroundColor: '#FFFFFF' },
  videoBadge: {
    position: 'absolute', top: 40, left: 16, backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 3,
  },
  videoPulse: { width: 8, height: 8, backgroundColor: COLORS.primaryKKULight, borderRadius: 4 },
  videoBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  badgeLike: {
    position: 'absolute', top: 50, right: 30, zIndex: 5,
    borderWidth: 4, borderColor: COLORS.likeColor, borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 6, transform: [{ rotate: '15deg' }],
  },
  badgeLikeText: { color: COLORS.likeColor, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  badgePass: {
    position: 'absolute', top: 50, left: 30, zIndex: 5,
    borderWidth: 4, borderColor: COLORS.passColor, borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 6, transform: [{ rotate: '-15deg' }],
  },
  badgePassText: { color: COLORS.passColor, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  cardContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, zIndex: 3,
  },
  userName: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  facultyBadge: {
    backgroundColor: 'rgba(139,0,0,0.6)', borderWidth: 1, borderColor: COLORS.primaryKKULight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    alignSelf: 'flex-start', marginTop: 6, marginBottom: 8,
  },
  facultyText: { color: '#FFE6E6', fontSize: 12, fontWeight: '500' },
  userBio: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 12,
  },
  tagText: { color: '#E2E8F0', fontSize: 12 },

  // Action Bar
  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
    paddingTop: 8,
    paddingBottom: 12,
  },
  actionBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', ...SHADOWS.button,
  },
  actionIcon: { fontSize: 22 },
  rewindBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)' },
  passBtn: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  superBtn: { borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  likeBtn: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },

  // Empty State
  emptyContainer: {
    flex: 1, backgroundColor: COLORS.bgDark, alignItems: 'center',
    justifyContent: 'center', padding: 30,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  reloadBtn: {
    marginTop: 20, backgroundColor: COLORS.primaryKKULight,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, ...SHADOWS.glow,
  },
  reloadBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },

  // Match Popup
  matchOverlay: {
    flex: 1, backgroundColor: COLORS.overlayDark, alignItems: 'center',
    justifyContent: 'center', padding: 30,
  },
  matchTitle: { fontSize: 32, fontWeight: '900', color: COLORS.accentGold, marginBottom: 8 },
  matchSubtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 30, textAlign: 'center' },
  matchAvatars: { flexDirection: 'row', gap: 16, marginBottom: 40 },
  matchAvatar: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 4,
    borderColor: COLORS.accentGold, ...SHADOWS.glow,
  },
  matchChatBtn: {
    width: '100%', backgroundColor: COLORS.primaryKKULight, paddingVertical: 14,
    borderRadius: 30, alignItems: 'center', marginBottom: 12, ...SHADOWS.glow,
  },
  matchChatBtnText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  matchContinueBtn: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 14,
    borderRadius: 30, alignItems: 'center',
  },
  matchContinueBtnText: { color: COLORS.textMain, fontWeight: '600', fontSize: 16 },
});
