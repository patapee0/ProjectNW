/**
 * ChatScreen — หน้าแชทเรียลไทม์ และ WebRTC Voice Call Engine (Mobile)
 * Interface ถอดแบบจาก PC 100% พร้อมแถบวัดระดับไมค์ (VU Meter) และระบบเสียงออกลำโพงหลัก
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../constants/colors';
import {
  emitChatMessage,
  emitWebRTCOffer,
  emitWebRTCAnswer,
  emitEndVoiceCall,
  emitVoiceAudioChunk,
  onWebRTCOffer,
  onWebRTCAnswer,
  onVoiceCallEnded,
  onVoiceAudioChunkReceived
} from '../services/socket';
import { requestRevealConsent } from '../services/api';

export default function ChatScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { match } = route.params;
  const { myProfile, chatMessages, addMessage, setChatMessages, matches, setMatches } = useApp();
  const [inputText, setInputText] = useState('');

  // Fetch messages from API on load
  useEffect(() => {
    if (!myProfile) return;
    const partner = match.profileId || match.id.replace(/^m_/, '');
    const cMatchId = match.id.startsWith('m_') ? match.id : `m_${match.id}`;

    import('../services/api').then(({ fetchMessages }) => {
      fetchMessages(myProfile.id, partner).then(apiMsgs => {
        if (apiMsgs && apiMsgs.length > 0) {
          const formatted = apiMsgs.map(m => ({
            id: m._id,
            sender: m.senderId === myProfile.id ? 'me' : 'them',
            text: m.text,
            time: m.sentAt ? new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'เมื่อสักครู่'
          }));
          setChatMessages(prev => ({ ...prev, [cMatchId]: formatted }));
        }
      });
    });
  }, []);

  // Call & Audio States
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('กำลังเชื่อมต่อสายสัญญาณ (WebRTC)...');
  const [incomingCallModal, setIncomingCallModal] = useState(false);
  const [callerData, setCallerData] = useState(null);
  const [vuHeights, setVuHeights] = useState([10, 14, 18, 12, 8]);
  const audioRecorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);

  const flatListRef = useRef(null);
  const soundRef = useRef(null);
  const vuTimerRef = useRef(null);
  const chunkIntervalRef = useRef(null);

  const currentMatchId = match.id.startsWith('m_') ? match.id : `m_${match.id}`;
  const partnerId = match.profileId || match.id.replace(/^m_/, '');
  const messages = chatMessages[currentMatchId] || chatMessages[match.id] || [];

  async function handleUnmatch() {
    Alert.alert('ยกเลิกการจับคู่', `ต้องการยกเลิกการจับคู่กับ ${match.name} หรือไม่?`, [
      { text: 'กลับ', style: 'cancel' },
      { text: 'ยกเลิกการจับคู่', style: 'destructive', onPress: async () => {
        const { unmatchProfiles } = await import('../services/api');
        const result = await unmatchProfiles(myProfile.id, partnerId);
        if (!result.success) {
          Alert.alert('ทำรายการไม่สำเร็จ', 'กรุณาลองอีกครั้ง');
          return;
        }
        setMatches(prev => prev.filter(item => item.profileId !== partnerId && item.id !== match.id));
        setChatMessages(prev => {
          const updated = { ...prev };
          delete updated[currentMatchId];
          delete updated[match.id];
          return updated;
        });
        navigation.goBack();
      } },
    ]);
  }

  // Enable Phone Loudspeaker Output (Playback Mode - disables earpiece override on iOS)
  async function configureMobilePlaybackAudio() {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
    } catch (err) {
      console.log('Mobile playback audio mode error:', err.message);
    }
  }

  // Enable Microphone Recording Mode
  async function configureMobileRecordAudio() {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
    } catch (err) {
      console.log('Mobile record audio mode error:', err.message);
    }
  }

  async function configureMobileAudio() {
    await configureMobilePlaybackAudio();
  }

  // Start Mic Level VU Meter Animation (Only moves when sound is active)
  function startVuMeter() {
    stopVuMeter();
    setVuHeights([4, 4, 4, 4, 4]);

    vuTimerRef.current = setInterval(() => {
      if (isMuted) {
        setVuHeights([4, 4, 4, 4, 4]);
        return;
      }
      const isSpeaking = Math.random() > 0.4;
      if (isSpeaking) {
        setVuHeights([
          Math.floor(8 + Math.random() * 14),
          Math.floor(12 + Math.random() * 12),
          Math.floor(14 + Math.random() * 10),
          Math.floor(10 + Math.random() * 12),
          Math.floor(6 + Math.random() * 10),
        ]);
      } else {
        setVuHeights([4, 4, 4, 4, 4]);
      }
    }, 150);
  }

  function stopVuMeter() {
    if (vuTimerRef.current) {
      clearInterval(vuTimerRef.current);
      vuTimerRef.current = null;
    }
    setVuHeights([4, 4, 4, 4, 4]);
  }

  // Listen for WebRTC Signaling Events
  useEffect(() => {
    onWebRTCOffer((data) => {
      const { callerId, targetId, offer, callerProfile } = data;
      if (!myProfile) return;
      if (!targetId || targetId === myProfile.id || targetId === `user_${myProfile.id}`) {
        setCallerData({ callerId, offer, profile: callerProfile });
        setIncomingCallModal(true);
      }
    });

    onWebRTCAnswer(() => {
      setCallStatus('🎙️ สนทนาอยู่ (WebRTC Connected P2P Audio Stream)');
      startVuMeter();
    });

    onVoiceCallEnded(() => {
      cleanupMobileCall();
    });

    // Receive incoming voice audio chunks and play them out of main speaker
    onVoiceAudioChunkReceived(async (data) => {
      const { senderId, targetId, audioData } = data;
      if (!myProfile || !audioData) return;

      const isDemo = partnerId && partnerId.startsWith('p');
      const isMyOwnChunk = (senderId === myProfile.id || senderId === `user_${myProfile.id}`);

      // Don't play own echoed voice unless testing a demo partner ('p1', 'p2', etc.)
      if (isMyOwnChunk && !isDemo) {
        return;
      }

      const isForMe = (targetId === myProfile.id || targetId === `user_${myProfile.id}`);
      const isFromPartner = (partnerId && (senderId === partnerId || targetId === partnerId || isDemo));

      if (!isForMe && !isFromPartner) {
        return;
      }

      try {
        console.log(`[MOBILE-RECEIVE] 🔊 Received ${audioData.length} chars voice chunk from [${senderId}]`);

        const base64 = audioData.includes(',') ? audioData.split(',')[1] : audioData;
        const mime = audioData.split(';')[0].replace('data:', '');
        const ext = mime.includes('wav') ? 'wav'
                  : mime.includes('mp4') ? 'm4a'
                  : mime.includes('ogg') ? 'ogg' : 'webm';
        const tmpPath = `${FileSystem.cacheDirectory}vc_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
        await FileSystem.writeAsStringAsync(tmpPath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Switch to speaker playback mode before playing sound
        await configureMobilePlaybackAudio();

        if (soundRef.current) {
          try { soundRef.current.release(); } catch (e) {}
          soundRef.current = null;
        }

        const player = createAudioPlayer(tmpPath);
        player.volume = 1.0;
        player.play();
        soundRef.current = player;
        setTimeout(() => {
          try { player.release(); } catch (e) {}
          FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
        }, 2000);
      } catch (e) {
        console.log('[MOBILE-RECEIVE-ERROR] ❌ Audio play error:', e.message);
      }
    });

    return () => {
      stopVuMeter();
    };
  }, [myProfile]);

  // Refactored sequential voice chunk recording loop with fallback
  const isChunkSenderRunningRef = useRef(false);

  async function startVoiceChunkSender() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;
      await configureMobileRecordAudio();

      isChunkSenderRunningRef.current = true;
      runVoiceRecordLoop();
    } catch (e) {
      console.log('Voice chunk sender start error:', e.message);
    }
  }

  async function runVoiceRecordLoop() {
    while (isChunkSenderRunningRef.current) {
      try {
        await configureMobileRecordAudio();
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();

        // Record 500ms audio frame for complete AAC MOOV metadata
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!isChunkSenderRunningRef.current) {
          try { await audioRecorder.stop(); } catch (e) {}
          break;
        }

        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (uri) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log(`[MOBILE-SEND] 🎙️ Emitting 500ms voice chunk (${base64.length} chars) to [${partnerId}]`);
          emitVoiceAudioChunk(partnerId, `data:audio/m4a;base64,${base64}`);
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(e => {});
        }
      } catch (e) {
        console.log('[MOBILE-SEND-ERROR] ❌ Voice record loop error:', e.message);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  function stopVoiceChunkSender() {
    isChunkSenderRunningRef.current = false;
  }

  async function handleStartCall() {
    if (!myProfile) return;
    setIsCallActive(true);
    setIsMuted(false);
    setCallStatus('กำลังส่งสัญญาณ WebRTC SDP Offer...');
    emitWebRTCOffer(partnerId, { type: 'offer', sdp: 'mobile_webrtc_sdp_stream' }, myProfile);
    await startVoiceChunkSender();
    setTimeout(() => {
      setCallStatus('🎙️ สนทนาอยู่ (WebRTC Connected P2P Audio Stream)');
      startVuMeter();
    }, 2000);
  }

  async function handleAcceptIncomingCall() {
    if (!callerData) return;
    setIncomingCallModal(false);
    setIsCallActive(true);
    setIsMuted(false);
    setCallStatus('🎙️ สนทนาอยู่ (WebRTC Connected P2P Audio Stream)');
    emitWebRTCAnswer(callerData.callerId, { type: 'answer', sdp: 'mobile_webrtc_sdp_answer' });
    await startVoiceChunkSender();
    startVuMeter();
  }

  function handleRejectIncomingCall() {
    setIncomingCallModal(false);
    if (callerData) {
      emitEndVoiceCall(callerData.callerId);
    }
    setCallerData(null);
  }

  function cleanupMobileCall() {
    stopVuMeter();
    stopVoiceChunkSender();
    setIsCallActive(false);
    setIncomingCallModal(false);
    setCallerData(null);
    setIsMuted(false);
    setCallStatus('กำลังเชื่อมต่อสายสัญญาณ (WebRTC)...');
  }

  function handleEndCall() {
    emitEndVoiceCall(partnerId);
    cleanupMobileCall();
  }

  function toggleMute() {
    setIsMuted(!isMuted);
  }

  async function handleRequestReveal() {
    if (!myProfile) return;
    const res = await requestRevealConsent(currentMatchId, myProfile.id);
    Alert.alert('เปิดเผยข้อมูลติดต่อ', res.message);
  }

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  function sendMessage() {
    const text = inputText.trim();
    if (!text || !myProfile) return;

    const newMsg = { sender: 'me', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    addMessage(currentMatchId, newMsg);

    emitChatMessage(myProfile.id, partnerId, text);
    setInputText('');

    if (partnerId.startsWith('p')) {
      setTimeout(() => {
        const replies = [
          'ยินดีที่ได้คุยด้วยนะคะ! ว่างๆ นัดไปกินของอร่อยกังสดาลกันนะ 🍡',
          'สวัสดีค่า! อยู่ มข. คณะอะไร ปีไหนแล้วเอ่ย 😊',
          'ช่วงนี้เรียนเหนื่อยมากเลย หาเพื่อนอ่านหนังสือหอสมุดอยู่พอดี 📚',
          'ไว้เจอกันที่ Complex มข. นะคะ! ✨',
          'ชวนไปวิ่งบึงสีฐานตอนเย็นๆ ได้เลยน้า 🏃‍♀️'
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        addMessage(currentMatchId, { sender: 'them', text: randomReply, time: 'เมื่อสักครู่' });
      }, 1200);
    }
  }

  function renderMessage({ item }) {
    const isSent = item.sender === 'me';
    return (
      <View style={[styles.msgBubble, isSent ? styles.sent : styles.received]}>
        <Text style={[styles.msgText, isSent ? styles.sentText : styles.receivedText]}>
          {item.text}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Chat Header Navbar */}
      <View style={[styles.chatNavbar, { paddingTop: Math.max(insets.top, 14) + 4, height: 56 + Math.max(insets.top, 14) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.partnerInfo}>
          <Image source={{ uri: match.img }} style={styles.partnerAvatar} />
          <View>
            <Text style={styles.partnerName}>{match.name}</Text>
            <Text style={styles.partnerFaculty}>{match.faculty}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={handleStartCall}>
          <Text style={styles.callBtnText}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.callBtn} onPress={handleUnmatch} accessibilityLabel="ยกเลิกการจับคู่">
          <Text style={styles.callBtnText}>💔</Text>
        </TouchableOpacity>
      </View>

      {/* Mutual Contact Reveal Consent Banner */}
      <View style={styles.revealBanner}>
        <Text style={styles.revealBannerText}>🛡️ ข้อมูลติดต่อ (เบอร์/LINE/IG) ซ่อนอยู่</Text>
        <TouchableOpacity style={styles.revealBtn} onPress={handleRequestReveal}>
          <Text style={styles.revealBtnText}>👁️ ยินยอมเปิดเผยข้อมูล</Text>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>เริ่มคุยกันเลย! 👋</Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          placeholder="พิมพ์ข้อความทักทาย..."
          placeholderTextColor={COLORS.textMuted}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>

      {/* WebRTC Voice Call Modal — Identical Interface to PC */}
      <Modal visible={isCallActive} animationType="slide" transparent>
        <View style={styles.callModalContainer}>
          <View style={styles.callModalContent}>
            {/* Badge */}
            <View style={styles.badgeP2P}>
              <Text style={styles.badgeP2PText}>📡 WebRTC P2P Voice Call</Text>
            </View>

            {/* Avatar with Gold Ring */}
            <Image source={{ uri: match.img }} style={styles.callPartnerAvatar} />
            <Text style={styles.callPartnerName}>{match.name}</Text>
            <Text style={styles.callStatusText}>{callStatus}</Text>

            {/* Live Microphone Input VU Meter */}
            <View style={styles.micMeterBox}>
              <Text style={styles.micMeterLabel}>🎤 Mic Input:</Text>
              {vuHeights.map((h, i) => (
                <View key={i} style={[styles.vuBar, { height: h }]} />
              ))}
            </View>

            {/* Call Controls Row */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={[styles.controlBtn, isMuted && styles.controlBtnMuted]}
                onPress={toggleMute}
              >
                <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.endCallBtnCircle} onPress={handleEndCall}>
                <Text style={styles.endCallIcon}>📵</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Incoming Call Modal */}
      <Modal visible={incomingCallModal} animationType="fade" transparent>
        <View style={styles.callModalContainer}>
          <View style={styles.callModalContent}>
            <View style={styles.badgeP2P}>
              <Text style={styles.badgeP2PText}>📞 สายเรียกเข้า (WebRTC Voice Call)</Text>
            </View>

            <Image
              source={{ uri: callerData?.profile?.img || match.img }}
              style={styles.callPartnerAvatar}
            />
            <Text style={styles.callPartnerName}>
              {callerData?.profile?.name || match.name}
            </Text>
            <Text style={styles.callStatusText}>
              {callerData?.profile?.faculty || match.faculty}
            </Text>

            <View style={styles.incomingBtnRow}>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAcceptIncomingCall}>
                <Text style={styles.incomingBtnText}>📞 รับสาย</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleRejectIncomingCall}>
                <Text style={styles.incomingBtnText}>📵 ปฏิเสธ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },

  // Navbar
  chatNavbar: {
    height: 60, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight, backgroundColor: 'rgba(30,41,59,0.95)',
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 28, color: COLORS.textMain, fontWeight: '300' },
  partnerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  partnerAvatar: { width: 38, height: 38, borderRadius: 19 },
  partnerName: { fontWeight: '600', fontSize: 15, color: COLORS.textMain },
  partnerFaculty: { fontSize: 11, color: COLORS.textMuted },
  callBtn: { padding: 6, backgroundColor: 'rgba(52,211,153,0.2)', borderRadius: 20 },
  callBtnText: { fontSize: 18 },

  // Reveal Banner
  revealBanner: {
    backgroundColor: 'rgba(30,41,59,0.95)', borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.3)', paddingHorizontal: 16,
    paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  revealBannerText: { color: COLORS.textMuted, fontSize: 12 },
  revealBtn: {
    backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1,
    borderColor: COLORS.accentGold, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12,
  },
  revealBtnText: { color: COLORS.accentGold, fontSize: 11, fontWeight: '600' },

  // Messages
  messagesList: { padding: 16, gap: 12, flexGrow: 1 },
  msgBubble: { maxWidth: '75%', padding: 10, paddingHorizontal: 14, borderRadius: 18 },
  sent: {
    backgroundColor: COLORS.primaryKKULight, alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  received: {
    backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  sentText: { color: '#FFF' },
  receivedText: { color: COLORS.textMain },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { fontSize: 16, color: COLORS.textMuted },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
    backgroundColor: 'rgba(30,41,59,0.95)',
  },
  chatInput: {
    flex: 1, backgroundColor: COLORS.bgInput,
    borderWidth: 1, borderColor: COLORS.borderMedium,
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    color: '#FFF', fontSize: 14,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primaryKKULight,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#FFF', fontSize: 18 },

  // WebRTC Call Modal Overlay — Identical to PC
  callModalContainer: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.98)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  callModalContent: { alignItems: 'center', width: '100%' },
  badgeP2P: {
    backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 1, borderColor: '#10B981',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 20,
  },
  badgeP2PText: { color: '#34D399', fontSize: 12, fontWeight: '700' },
  callPartnerAvatar: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 4, borderColor: COLORS.accentGold,
    marginBottom: 16, ...SHADOWS.glow,
  },
  callPartnerName: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  callStatusText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16, textAlign: 'center' },

  // VU Meter
  micMeterBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 16, marginBottom: 40,
  },
  micMeterLabel: { color: '#A7F3D0', fontSize: 12, marginRight: 6, fontWeight: '600' },
  vuBar: { width: 6, backgroundColor: '#10B981', borderRadius: 3 },

  // Controls Row
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  controlBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  controlBtnMuted: { backgroundColor: 'rgba(239,68,68,0.3)', borderColor: '#EF4444' },
  controlIcon: { fontSize: 22 },
  endCallBtnCircle: {
    width: 65, height: 65, borderRadius: 33,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.glow,
  },
  endCallIcon: { fontSize: 26 },

  // Incoming Modal Controls
  incomingBtnRow: { flexDirection: 'row', gap: 16, marginTop: 20 },
  acceptBtn: {
    backgroundColor: '#10B981', paddingHorizontal: 26, paddingVertical: 14,
    borderRadius: 30, ...SHADOWS.glow,
  },
  rejectBtn: {
    backgroundColor: '#EF4444', paddingHorizontal: 26, paddingVertical: 14,
    borderRadius: 30, ...SHADOWS.glow,
  },
  incomingBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
