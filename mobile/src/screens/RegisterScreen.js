/**
 * RegisterScreen / LoginScreen — KKU Student Verification & Social Login
 * บังคับเข้าใช้งานด้วย @kkumail.com เท่านั้น + เชื่อมต่อ Facebook/IG ในหน้า Login
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../constants/colors';
import { KKU_FACULTIES } from '../constants/faculties';
import { registerProfile, verifyKkuMail, linkSocialMedia } from '../services/api';
import { connectSocket, registerSocketUser } from '../services/socket';

const DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { setMyProfile } = useApp();
  const [kkuEmail, setKkuEmail] = useState('patapee.s@kkumail.com');
  const [name, setName] = useState('ปฐพี (Beam)');
  const [faculty, setFaculty] = useState(KKU_FACULTIES[0].value);
  const [bio, setBio] = useState('แวะมาชวนไปกินบิงซูกังสดาล หรือนั่งอ่านหนังสือหอสมุด มข. ได้นะ! ☕️');
  const [fbHandle, setFbHandle] = useState('fb.com/patapee.kk');
  const [igHandle, setIgHandle] = useState('@beam_kkup');
  const [photoUrl, setPhotoUrl] = useState(DEFAULT_PHOTO);
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // เลือกรูปภาพจากเครื่อง
  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('คำขอสิทธิ์', 'กรุณาอนุญาตให้เข้าถึงรูปภาพเพื่อเลือกรูปโปรไฟล์');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const imageUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoUrl(imageUri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้');
    }
  }

  async function handleLoginAndRegister() {
    const email = kkuEmail.trim().toLowerCase();

    // Strict Domain Check — Enforce @kkumail.com
    if (!email || !email.endsWith('@kkumail.com')) {
      Alert.alert(
        'เข้าสู่ระบบไม่สำเร็จ ❌',
        'ระบบบังคับให้เข้าใช้งานด้วยอีเมลมหาวิทยาลัยขอนแก่น (@kkumail.com) เท่านั้น!\n\nหากไม่ใช่อีเมล @kkumail.com จะไม่สามารถเข้าใช้งานแอปพลิเคชันได้'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Verify KKU Student Domain with Backend
      const authRes = await verifyKkuMail(email);
      if (!authRes.success) {
        Alert.alert('ยืนยันตัวตนล้มเหลว', authRes.message);
        setIsSubmitting(false);
        return;
      }

      // 2. Link Facebook & Instagram Social Handles
      if (fbHandle.trim()) {
        await linkSocialMedia('facebook', fbHandle.trim());
      }
      if (igHandle.trim()) {
        await linkSocialMedia('instagram', igHandle.trim());
      }

      const displayName = name.trim() || authRes.user.name || 'นิสิต มข.';
      const displayBio = bio.trim() || 'แวะมาชวนไปกินบิงซูกังสดาลได้นะ!';
      const profileId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const profile = {
        id: profileId,
        kkuEmail: email,
        studentId: authRes.user.studentId,
        isKkuVerified: true,
        name: displayName,
        faculty: faculty || authRes.user.faculty,
        bio: displayBio,
        img: photoUrl,
        facebook: fbHandle,
        instagram: igHandle,
        age: 20,
        media: [{ type: 'image', url: photoUrl }]
      };

      // 3. Register to backend database
      await registerProfile({
        id: profileId,
        name: displayName,
        faculty: profile.faculty,
        bio: displayBio,
        photoUrl,
        kkuEmail: email,
        studentId: authRes.user.studentId,
        facebook: fbHandle,
        instagram: igHandle
      });

      // 4. Save local state & grant full entry
      await setMyProfile(profile);

      // 5. Connect Socket.IO
      connectSocket();
      registerSocketUser(profileId);

      Alert.alert('เข้าสู่ระบบสำเร็จ! 🎉', `ยินดีต้อนรับ ${displayName}\nรหัสนักศึกษา: ${authRes.user.studentId}\nเข้าสู่ระบบ KKU Account เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลังบ้านได้');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 14) + 14 }]}>
      <View style={styles.headerSection}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>💖</Text>
        </View>
        <Text style={styles.title}>KKU Student Login</Text>
        <Text style={styles.subtitle}>
          เข้าสู่ระบบและยืนยันตัวตนด้วย KKU Account (@kkumail.com)
        </Text>
      </View>

      {/* Domain Enforcement Alert Banner */}
      <View style={styles.kkuNoticeBanner}>
        <Text style={styles.kkuNoticeIcon}>🎓</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.kkuNoticeTitle}>เฉพาะนักศึกษามหาวิทยาลัยขอนแก่นเท่านั้น</Text>
          <Text style={styles.kkuNoticeText}>ระบบสงวนสิทธิ์การใช้งานเฉพาะผู้ถืออีเมล @kkumail.com เพื่อความปลอดภัยของนักศึกษา มข.</Text>
        </View>
      </View>

      {/* Avatar Picker Preview */}
      <View style={styles.previewSection}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarTouchable}>
          <Image source={{ uri: photoUrl }} style={styles.previewImg} />
          <View style={styles.changePhotoBadge}>
            <Text style={styles.changePhotoBadgeText}>📷 เลือกรูปโปรไฟล์</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Login Form */}
      <View style={styles.formCard}>
        {/* KKU Mail Input (REQUIRED) */}
        <View style={styles.formGroup}>
          <Text style={styles.labelRequired}>🎓 อีเมลมหาวิทยาลัยขอนแก่น (@kkumail.com) *</Text>
          <TextInput
            style={[styles.input, styles.kkuInputHighlight]}
            value={kkuEmail}
            onChangeText={setKkuEmail}
            placeholder="student.name@kkumail.com"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        {/* Display Name */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>ชื่อที่แสดง (Display Name) *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="เช่น น้องบีม วิศวะ"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Faculty */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>คณะ (KKU Faculty) *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowFacultyPicker(!showFacultyPicker)}
          >
            <Text style={{ color: COLORS.textMain }}>{faculty}</Text>
          </TouchableOpacity>
          {showFacultyPicker && (
            <View style={styles.pickerDropdown}>
              {KKU_FACULTIES.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.pickerItem, faculty === f.value && styles.pickerItemActive]}
                  onPress={() => { setFaculty(f.value); setShowFacultyPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Bio */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>คำแนะนำตัว (Bio & Intro)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="แนะนำตัวสั้นๆ ชวนไปไหน..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Social Media Linking Fields */}
        <View style={styles.socialSection}>
          <Text style={styles.socialHeader}>🔗 เชื่อมต่อ Social Media (Facebook & IG Login Enrichment)</Text>
          
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.socialSubLabel}>🔵 Facebook Profile / Handle</Text>
            <TextInput
              style={styles.input}
              value={fbHandle}
              onChangeText={setFbHandle}
              placeholder="fb.com/patapee.kk"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
          </View>

          <View>
            <Text style={styles.socialSubLabel}>🟣 Instagram Handle</Text>
            <TextInput
              style={styles.input}
              value={igHandle}
              onChangeText={setIgHandle}
              placeholder="@beam_kkup"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.registerBtn}
          onPress={handleLoginAndRegister}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.registerBtnText}>🔐 ยืนยันตัวตน KKUMail & เข้าสู่ระบบ</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  scrollContent: { padding: 20, paddingBottom: 40 },

  headerSection: { alignItems: 'center', marginBottom: 16 },
  logoContainer: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.primaryKKULight, alignItems: 'center',
    justifyContent: 'center', marginBottom: 10, ...SHADOWS.glow,
  },
  logoIcon: { fontSize: 28 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.accentGold, marginBottom: 4 },
  subtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },

  kkuNoticeBanner: {
    backgroundColor: 'rgba(165,28,48,0.2)', borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.4)', borderRadius: RADIUS.md,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 16,
  },
  kkuNoticeIcon: { fontSize: 24 },
  kkuNoticeTitle: { color: COLORS.accentGold, fontWeight: '700', fontSize: 13, marginBottom: 2 },
  kkuNoticeText: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },

  previewSection: { alignItems: 'center', marginBottom: 16 },
  avatarTouchable: { position: 'relative', alignItems: 'center' },
  previewImg: {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 3, borderColor: COLORS.accentGold,
  },
  changePhotoBadge: {
    position: 'absolute', bottom: -6, backgroundColor: COLORS.primaryKKULight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.accentGold,
  },
  changePhotoBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md,
    padding: 16,
  },
  formGroup: { marginBottom: 14 },
  label: { fontSize: 13, color: COLORS.textMuted, marginBottom: 6 },
  labelRequired: { fontSize: 13, color: COLORS.accentGold, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMedium,
    borderRadius: 10, padding: 10, paddingHorizontal: 14,
    color: '#FFF', fontSize: 14,
  },
  kkuInputHighlight: {
    borderColor: COLORS.accentGold,
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  textArea: { minHeight: 64, textAlignVertical: 'top' },

  socialSection: {
    backgroundColor: 'rgba(30,41,59,0.7)', borderRadius: 12,
    padding: 12, borderHeight: 1, borderColor: COLORS.borderLight,
    marginBottom: 16, marginTop: 4,
  },
  socialHeader: { color: '#FFF', fontWeight: '700', fontSize: 12, marginBottom: 10 },
  socialSubLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 4 },

  pickerDropdown: {
    backgroundColor: COLORS.bgCard, borderRadius: 10, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.borderMedium, overflow: 'hidden',
  },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  pickerItemActive: { backgroundColor: 'rgba(139,0,0,0.3)' },
  pickerItemText: { color: COLORS.textMain, fontSize: 14 },

  registerBtn: {
    backgroundColor: COLORS.primaryKKULight, paddingVertical: 15,
    borderRadius: 30, alignItems: 'center', marginTop: 4, ...SHADOWS.glow,
  },
  registerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
