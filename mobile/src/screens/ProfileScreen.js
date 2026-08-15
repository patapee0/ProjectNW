/**
 * ProfileScreen — หน้าแก้ไขโปรไฟล์ (พร้อมเปลี่ยนรูปภาพ)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, ScrollView, Alert, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../constants/colors';
import { KKU_FACULTIES } from '../constants/faculties';
import { registerProfile } from '../services/api';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { myProfile, setMyProfile, resetAllData } = useApp();
  const [name, setName] = useState(myProfile?.name || '');
  const [faculty, setFaculty] = useState(myProfile?.faculty || KKU_FACULTIES[0].value);
  const [bio, setBio] = useState(myProfile?.bio || '');
  const [photoUrl, setPhotoUrl] = useState(myProfile?.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80');
  const [showFacultyPicker, setShowFacultyPicker] = useState(false);

  // เลือกรูปภาพจากเครื่อง
  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('คำขอสิทธิ์', 'กรุณาอนุญาตให้เข้าถึงรูปภาพเพื่อเปลี่ยนรูปโปรไฟล์');
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

  async function saveChanges() {
    if (!myProfile) return;

    const updatedProfile = {
      ...myProfile,
      name: name || myProfile.name,
      faculty,
      bio,
      img: photoUrl,
      media: [{ type: 'image', url: photoUrl }]
    };

    await setMyProfile(updatedProfile);

    // Sync to server
    try {
      await registerProfile({
        id: updatedProfile.id,
        name: updatedProfile.name,
        faculty: updatedProfile.faculty,
        bio: updatedProfile.bio,
        photoUrl,
      });
    } catch (e) {
      console.log('Profile update sync error:', e);
    }

    Alert.alert('สำเร็จ ✅', 'บันทึกการเปลี่ยนแปลงโปรไฟล์เรียบร้อยแล้ว!');
  }

  function handleReset() {
    Alert.alert(
      'รีเซ็ตข้อมูล',
      'ต้องการลบข้อมูลทั้งหมดในเครื่องนี้หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ลบทั้งหมด', style: 'destructive', onPress: resetAllData },
      ]
    );
  }

  if (!myProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>กรุณาลงทะเบียนก่อน</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 14) + 10 }]}>
      <Text style={styles.header}>👤 โปรไฟล์ KKU Dating ของฉัน</Text>

      {/* Profile Preview & Avatar Picker */}
      <View style={styles.profileCard}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarTouchable}>
          <Image source={{ uri: photoUrl }} style={styles.profileImg} />
          <View style={styles.changePhotoBadge}>
            <Text style={styles.changePhotoBadgeText}>📷 เปลี่ยนรูป</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.profileName}>{name || myProfile.name}</Text>
        <Text style={styles.profileFaculty}>{faculty}</Text>
      </View>

      {/* Edit Form */}
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
            placeholder="ชื่อของคุณ"
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
          <Text style={styles.label}>คำแนะนำตัว (Bio & Intro)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="แนะนำตัวสั้นๆ..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveChanges}>
          <Text style={styles.saveBtnText}>💾 บันทึกการเปลี่ยนแปลง</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.formCard}>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>🗑️ รีเซ็ตข้อมูลเครื่องนี้</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 18, fontWeight: '700', color: COLORS.accentGold, marginBottom: 16 },
  emptyText: { fontSize: 16, color: COLORS.textMuted, textAlign: 'center', marginTop: 60 },

  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginBottom: 16,
  },
  avatarTouchable: { position: 'relative', alignItems: 'center', marginBottom: 10 },
  profileImg: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: COLORS.accentGold,
  },
  changePhotoBadge: {
    position: 'absolute', bottom: -6, backgroundColor: COLORS.primaryKKULight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.accentGold,
  },
  changePhotoBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  profileName: { fontSize: 17, fontWeight: '600', color: '#FFF', marginTop: 6 },
  profileFaculty: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },

  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md,
    padding: 16, marginBottom: 16,
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  pickerDropdown: {
    backgroundColor: COLORS.bgCard, borderRadius: 10, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.borderMedium, overflow: 'hidden',
  },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  pickerItemActive: { backgroundColor: 'rgba(139,0,0,0.3)' },
  pickerItemText: { color: COLORS.textMain, fontSize: 14 },

  saveBtn: {
    backgroundColor: COLORS.primaryKKULight, paddingVertical: 14,
    borderRadius: 30, alignItems: 'center', ...SHADOWS.glow,
  },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },

  resetBtn: {
    backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: COLORS.passColor,
    paddingVertical: 14, borderRadius: 30, alignItems: 'center',
  },
  resetBtnText: { color: '#FF8888', fontWeight: '600', fontSize: 15 },
});
