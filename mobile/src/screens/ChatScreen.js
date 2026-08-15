/**
 * ChatScreen — หน้าแชทเรียลไทม์
 * แทน conversation-modal ของ Web เดิม
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, FlatList, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS } from '../constants/colors';
import { emitChatMessage } from '../services/socket';

export default function ChatScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { match } = route.params;
  const { myProfile, chatMessages, addMessage } = useApp();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  const currentMatchId = match.id.startsWith('m_') ? match.id : `m_${match.id}`;
  const partnerId = match.profileId || match.id.replace(/^m_/, '');
  const messages = chatMessages[currentMatchId] || chatMessages[match.id] || [];

  useEffect(() => {
    // Scroll to bottom on new messages
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  function sendMessage() {
    const text = inputText.trim();
    if (!text || !myProfile) return;

    // 1. Optimistic Local UI Update (ทันทีไม่ต้องรอ Socket)
    const newMsg = { sender: 'me', text, time: 'เมื่อสักครู่' };
    addMessage(currentMatchId, newMsg);

    // 2. Emit via Socket.IO ไปยัง Server / อุปกรณ์อีกเครื่อง
    emitChatMessage(myProfile.id, partnerId, text);

    setInputText('');

    // 3. ถ้าคุยกับ Demo Profile (p1, p2, p3) ให้ตอบกลับอัตโนมัติ
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
      {/* Chat Header */}
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
});
