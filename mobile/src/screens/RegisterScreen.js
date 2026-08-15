/**
 * RegisterScreen — หน้าลงทะเบียนโปรไฟล์ (พร้อมอัปโหลดรูปภาพ)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, ScrollView, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../constants/colors';
import { KKU_FACULTIES } from '../constants/faculties';
import { registerProfile } from '../services/api';
import { connectSocket, registerSocketUser } from '../services/socket';

const DEFAULT_PHOTO = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { setMyProfile } = useApp();
  const [name, setName] = useState('');
  const [faculty, setFaculty] = useState(KKU_FACULTIES[0].value);
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState(DEFAULT_PHOTO);
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);

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

  async function handleRegister() {
    const displayName = name.trim() || 'นิสิต มข.';
    const displayBio = bio.trim() || 'แวะมาชวนไปกินบิงซูกังสดาลได้นะ!';

    const profileId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const profile = {
      id: profileId,
      name: displayName,
      faculty,
      bio: displayBio,
      img: photoUrl,
      age: 20,
      media: [{ type: 'image', url: photoUrl }]
    };

    // Save locally
    await setMyProfile(profile);

    // Sync to server
    try {
      await registerProfile({
        id: profileId,
        name: displayName,
        faculty,
        bio: displayBio,
        photoUrl,
      });
    } catch (e) {
      console.log('Register sync error:', e);
    }

    // Connect socket
    connectSocket();
    registerSocketUser(profileId);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 14) + 14 }]}>
      <View style={styles.headerSection}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>💖</Text>
        </View>
        <Text style={styles.title}>สร้างโปรไฟล์ KKU Dating</Text>
        <Text style={styles.subtitle}>
          ยินดีต้อนรับ! กรุณาสร้างโปรไฟล์เพื่อเริ่มหาคู่ใน มข.
        </Text>
      </View>

      {/* Preview & Avatar Picker */}
      <View style={styles.previewSection}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarTouchable}>
          <Image source={{ uri: photoUrl }} style={styles.previewImg} />
          <View style={styles.changePhotoBadge}>
            <Text style={styles.changePhotoBadgeText}>📷 เลือกรูปภาพ</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.formCard}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>รูปภาพโปรไฟล์ (Profile Photo)</Text>
          <TouchableOpacity style={styles.pickImageBtn} onPress={pickImage}>
            <Text style={styles.pickImageBtnText}>🖼️ เลือกรูปภาพจากเครื่อง...</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>ชื่อที่แสดง (Display Name)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="เช่น น้องแพรว วิศวะ"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>คณะ (KKU Faculty)</Text>
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

        <View style={styles.formGroup}>
          <Text style={styles.label}>คำแนะนำตัว (Bio)</Text>
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

        <TouchableOpacity style={styles.registerBtn} onPress={handleRegister}>
          <Text style={styles.registerBtnText}>🚀 สร้างโปรไฟล์และเข้าใช้งาน</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  scrollContent: { padding: 20, paddingBottom: 40 },

  headerSection: { alignItems: 'center', marginBottom: 20 },
  logoContainer: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.primaryKKULight, alignItems: 'center',
    justifyContent: 'center', marginBottom: 12, ...SHADOWS.glow,
  },
  logoIcon: { fontSize: 28 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.accentGold, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  previewSection: { alignItems: 'center', marginBottom: 20 },
  avatarTouchable: { position: 'relative', alignItems: 'center' },
  previewImg: {
    width: 90, height: 90, borderRadius: 45,
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
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: COLORS.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.borderMedium,
    borderRadius: 10, padding: 10, paddingHorizontal: 14,
    color: '#FFF', fontSize: 14,
  },
  pickImageBtn: {
    backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.accentGold,
    borderStyle: 'dashed', borderRadius: 10, padding: 12, alignItems: 'center',
  },
  pickImageBtnText: { color: COLORS.accentGold, fontWeight: '600', fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },

  pickerDropdown: {
    backgroundColor: COLORS.bgCard, borderRadius: 10, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.borderMedium, overflow: 'hidden',
  },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  pickerItemActive: { backgroundColor: 'rgba(139,0,0,0.3)' },
  pickerItemText: { color: COLORS.textMain, fontSize: 14 },

  registerBtn: {
    backgroundColor: COLORS.primaryKKULight, paddingVertical: 16,
    borderRadius: 30, alignItems: 'center', marginTop: 8, ...SHADOWS.glow,
  },
  registerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
