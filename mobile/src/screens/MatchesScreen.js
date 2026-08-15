/**
 * MatchesScreen — หน้ารายชื่อแมตช์ + ข้อความแชท
 * แทน view-matches ของ Web เดิม
 */
import React from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, FlatList
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS } from '../constants/colors';

export default function MatchesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { matches } = useApp();

  function openChat(match) {
    navigation.navigate('Chat', { match });
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 14) + 6 }]}>
      {/* New Matches - Horizontal scroll */}
      <Text style={styles.sectionTitle}>แมตช์ใหม่ของคุณ (New Matches)</Text>
      {matches.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.matchesScroll}
        >
          {matches.map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.matchAvatarItem}
              onPress={() => openChat(match)}
            >
              <View style={styles.avatarRing}>
                <Image source={{ uri: match.img }} style={styles.avatarImg} />
              </View>
              <Text style={styles.matchName} numberOfLines={1}>
                {match.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyMatches}>
          <Text style={styles.emptyText}>ยังไม่มีแมตช์ ลองปัดหาคู่ดูนะ! 💕</Text>
        </View>
      )}

      {/* Chat Messages List */}
      <Text style={styles.sectionTitle}>ข้อความแชท (Messages)</Text>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.chatItem} onPress={() => openChat(item)}>
            <Image source={{ uri: item.img }} style={styles.chatAvatar} />
            <View style={styles.chatInfo}>
              <View style={styles.chatHeaderRow}>
                <Text style={styles.chatUserName}>{item.name}</Text>
                <Text style={styles.chatTime}>{item.time}</Text>
              </View>
              <Text style={styles.chatLastMsg} numberOfLines={1}>{item.lastMsg}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyText}>ยังไม่มีข้อความ</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    color: COLORS.textMuted, letterSpacing: 1, paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 8,
  },
  matchesScroll: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  matchAvatarItem: { alignItems: 'center', gap: 6, width: 65 },
  avatarRing: {
    width: 62, height: 62, borderRadius: 31, padding: 2,
    borderWidth: 2, borderColor: COLORS.accentGold,
  },
  avatarImg: {
    width: '100%', height: '100%', borderRadius: 30,
    borderWidth: 2, borderColor: COLORS.bgDark,
  },
  matchName: {
    fontSize: 11, fontWeight: '500', color: COLORS.textMain,
    maxWidth: 65, textAlign: 'center',
  },
  chatItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  chatAvatar: { width: 52, height: 52, borderRadius: 26 },
  chatInfo: { flex: 1 },
  chatHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  chatUserName: { fontWeight: '600', fontSize: 15, color: COLORS.textMain },
  chatTime: { fontSize: 11, color: COLORS.textMuted },
  chatLastMsg: { fontSize: 13, color: COLORS.textMuted },
  emptyMatches: { paddingHorizontal: 20, paddingVertical: 16 },
  emptyChat: { paddingHorizontal: 20, paddingVertical: 30, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
