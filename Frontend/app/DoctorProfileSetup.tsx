import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentProfile } from '../services/medirakshaApi';
import { updateStoredProfile } from '../services/auth';
import {
  isValidDoctorSpecialization,
} from '../constants/specializations';
import SpecializationPickerModal from '../components/SpecializationPickerModal';

const genderOptions = ['Male', 'Female', 'Other'];

export default function DoctorProfileSetup() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    doctorId: '',
    name: '',
    age: '',
    gender: 'Male',
    number: '',
    hospital: '',
    specialization: '',
  });

  const [specModalVisible, setSpecModalVisible] = useState(false);
  const [specSearch, setSpecSearch] = useState('');

  const fetchProfile = async () => {
    try {
      const data = await getCurrentProfile('Doctor');
      const rawGender = String(data.gender || 'male').toLowerCase();
      const formattedGender =
        rawGender === 'female' ? 'Female' : rawGender === 'other' ? 'Other' : 'Male';

      setFormData({
        doctorId: data.doctorId || data.id || '',
        name: data.name || '',
        age: data.age?.toString() || '',
        gender: formattedGender,
        number: data.number || data.phoneNumber || '',
        hospital: data.hospital || '',
        specialization: data.specialization || data.speciality || 'General Physician',
      });
    } catch (error) {
      console.error('Error fetching doctor profile:', error);
      Alert.alert('Error', 'Could not load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSelectSpecialization = (option: any) => {
    setFormData((prev) => ({ ...prev, specialization: option.value }));
    setSpecModalVisible(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.hospital.trim() || !formData.specialization.trim()) {
      Alert.alert('Required Fields', 'Please fill in doctor name, hospital, and specialization.');
      return;
    }

    if (!isValidDoctorSpecialization(formData.specialization)) {
      Alert.alert(
        'Invalid Specialization',
        'Please select an approved medical doctor specialization from the list.'
      );
      setSpecModalVisible(true);
      return;
    }

    setSaving(true);
    try {
      const normalizedGender = formData.gender.toLowerCase();
      const payload: any = {
        name: formData.name.trim(),
        hospital: formData.hospital.trim(),
        speciality: formData.specialization.trim(),
        age: parseInt(formData.age, 10) || 0,
        gender: normalizedGender,
        number: formData.number.trim(),
      };

      const res = await API.patch('/doctor/info/update', payload);

      // Update local storage so the session immediately reflects new info
      await updateStoredProfile({
        name: payload.name,
        hospital: payload.hospital,
        speciality: payload.speciality,
        specialization: payload.speciality,
        age: payload.age,
        gender: payload.gender,
        number: payload.number,
      });

      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Update Failed',
        error.response?.data?.message || error.response?.data?.msg || 'Could not update profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="close" size={26} color="#1A237E" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Edit Doctor Profile</Text>
            </View>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.rightBtn}>
              {saving ? (
                <ActivityIndicator size="small" color="#1A237E" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <LinearGradient colors={['#1A237E', '#3949AB']} style={styles.avatarCircle}>
              <FontAwesome5 name="user-md" size={48} color="#fff" />
            </LinearGradient>
            <Text style={styles.doctorHeaderName}>{formData.name ? `Dr. ${formData.name.replace(/^Dr\.\s*/i, '')}` : 'Doctor Profile'}</Text>
            <Text style={styles.doctorHeaderSpec}>{formData.specialization || 'Clinical Specialist'}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <InputGroup
              label="Doctor ID (Verified)"
              value={formData.doctorId}
              editable={false}
              icon="id-card"
            />

            <InputGroup
              label="Full Name *"
              value={formData.name}
              onChangeText={(t: string) => setFormData({ ...formData, name: t })}
              placeholder="e.g. Dr. Rajesh Sharma"
              icon="user"
            />

            {/* Specialization Selection Dropdown Button */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Medical Specialization *</Text>
                <Text style={styles.restrictedBadge}>Verified Only</Text>
              </View>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setSpecModalVisible(true)}
                activeOpacity={0.8}
              >
                <FontAwesome5 name="stethoscope" size={16} color="#1A237E" style={styles.inputIcon} />
                <Text
                  style={[
                    styles.dropdownValue,
                    !formData.specialization && styles.dropdownPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {formData.specialization || 'Select doctor specialization...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Select your recognized medical specialty from the approved list.
              </Text>
            </View>

            <InputGroup
              label="Hospital / Clinic Name *"
              value={formData.hospital}
              onChangeText={(t: string) => setFormData({ ...formData, hospital: t })}
              placeholder="e.g. Max Super Speciality Hospital"
              icon="hospital"
            />

            <InputGroup
              label="Contact Number"
              value={formData.number}
              onChangeText={(t: string) => setFormData({ ...formData, number: t })}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              icon="phone-alt"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <InputGroup
                  label="Age"
                  value={formData.age}
                  onChangeText={(t: string) => setFormData({ ...formData, age: t })}
                  placeholder="38"
                  keyboardType="numeric"
                  icon="birthday-cake"
                />
              </View>

              <View style={{ flex: 1.5 }}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                  {genderOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.genderPill,
                        formData.gender === opt && styles.genderPillActive,
                      ]}
                      onPress={() => setFormData({ ...formData, gender: opt })}
                    >
                      <Text
                        style={[
                          styles.genderText,
                          formData.gender === opt && styles.genderTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.saveLargeButton} onPress={handleSave} disabled={saving}>
              <LinearGradient colors={['#1A237E', '#3949AB']} style={styles.saveLargeGradient}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.saveLargeText}>Save Profile Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/Login')}>
              <MaterialIcons name="logout" size={20} color="#EF4444" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SPECIALIZATION DROPDOWN MODAL */}
      <SpecializationPickerModal
        visible={specModalVisible}
        onClose={() => setSpecModalVisible(false)}
        selectedValue={formData.specialization}
        onSelect={handleSelectSpecialization}
      />
    </SafeAreaView>
  );
}

const InputGroup = ({ label, icon, ...props }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View
      style={[
        styles.inputContainer,
        !props.editable && props.editable !== undefined && styles.disabledInput,
      ]}
    >
      <FontAwesome5 name={icon} size={16} color="#94A3B8" style={styles.inputIcon} />
      <TextInput style={styles.input} {...props} placeholderTextColor="#94A3B8" />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  rightBtn: { width: 64, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A237E' },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#1A237E' },
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1A237E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  doctorHeaderName: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 12 },
  doctorHeaderSpec: { fontSize: 14, fontWeight: '600', color: '#64748B', marginTop: 2 },
  form: { paddingHorizontal: 20 },
  inputGroup: { marginBottom: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  restrictedBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 15,
  },
  dropdownSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 15,
    height: 52,
  },
  dropdownValue: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  dropdownPlaceholder: { color: '#94A3B8', fontWeight: '500' },
  helperText: { fontSize: 12, color: '#64748B', marginTop: 4 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 50, fontSize: 15, color: '#0F172A', fontWeight: '600' },
  disabledInput: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  genderRow: { flexDirection: 'row', gap: 6, height: 50, alignItems: 'center' },
  genderPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderPillActive: { backgroundColor: '#EEF2FF', borderColor: '#1A237E' },
  genderText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  genderTextActive: { color: '#1A237E', fontWeight: '800' },
  actionContainer: { paddingHorizontal: 20, marginTop: 14 },
  saveLargeButton: { borderRadius: 16, overflow: 'hidden', elevation: 3 },
  saveLargeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  saveLargeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 12,
  },
  logoutText: { color: '#EF4444', fontWeight: '800', marginLeft: 8, fontSize: 15 },

  // Modal Styles
  modalRoot: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1A237E' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { padding: 8 },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  modalSearchInput: { flex: 1, fontSize: 15, color: '#0F172A' },
  specListContent: { paddingHorizontal: 16, paddingBottom: 30 },
  specItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specItemCardSelected: {
    borderColor: '#1A237E',
    backgroundColor: '#F5F7FF',
  },
  specIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  specIconWrapSelected: {
    backgroundColor: '#1A237E',
  },
  specTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  specItemLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  specItemLabelSelected: { color: '#1A237E' },
  specCategoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  specCategoryText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  specItemDesc: { fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
});
