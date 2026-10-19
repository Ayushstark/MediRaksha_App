import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import { AppButton, AppHeader } from '../components/ui/AppUI';
import { useToast } from '../components/ui/ToastProvider';
import { colors, radius, shadows, spacing } from '../constants/theme';
import { getCurrentProfile } from '../services/medirakshaApi';
import { updateStoredProfile } from '../services/auth';

const sexOptions = ['Male', 'Female', 'Third Gender'];
const roleOptions = ['Patient', 'Doctor'];

export default function ProfileEditScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [role, setRole] = useState('');

  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const userData = await getCurrentProfile('Patient');

        setRole(userData.role || 'Patient');

        if (userData) {
          setName(userData.name || '');
          setEmail(userData.email || userData.doctorId || '');
          setAge(userData.age ? String(userData.age) : '');
          const rawGender = String(userData.gender || '').toLowerCase();
          const formattedGender =
            rawGender === 'female' ? 'Female' : rawGender === 'other' ? 'Third Gender' : rawGender === 'male' ? 'Male' : '';
          setSex(formattedGender);
          setPhone(userData.phoneNumber || userData.number || '');
        }
      } catch {
        Alert.alert('Error', 'Failed to load profile. Please login again.');
        router.replace('/Login');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name.');
      return;
    }

    try {
      setSaving(true);
      const cleanSex = sex.trim().toLowerCase();
      const normalizedGender = cleanSex === 'third gender' ? 'other' : cleanSex || 'other';
      const parsedAge = parseInt(age, 10);
      const payload: any = {
        name: name.trim(),
        gender: normalizedGender,
        number: phone.trim(),
      };
      if (!isNaN(parsedAge) && parsedAge > 0) {
        payload.age = parsedAge;
      }

      await API.patch('/user/info/update', payload);

      // Update SecureStore profile cache so session is immediately up to date
      await updateStoredProfile({
        name: payload.name,
        gender: payload.gender,
        age: payload.age,
        number: payload.number,
        phoneNumber: payload.number,
      });

      showToast({ type: 'success', message: 'Profile updated successfully' });

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(role === 'Doctor' ? '/DoctorDashboard' : '/PatientDashboard');
      }
    } catch (error: any) {
      console.error('Update profile error:', error);
      showToast({
        type: 'error',
        message: error.response?.data?.message || error.response?.data?.msg || 'Failed to update profile',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppHeader
          title="Edit Profile"
          subtitle="Keep your care details updated for appointments and reports."
          onBack={() => router.back()}
        />

        <View style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.headerIcon}>
              <Feather name="user" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <Text style={styles.cardSub}>Required fields are marked with *</Text>
            </View>
          </View>

          <Field label="Full Name *" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Email *" value={email} editable={false} muted />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Age" value={age} onChangeText={setAge} keyboardType="numeric" />

          <Text style={styles.sectionLabel}>Sex *</Text>
          <View style={styles.optionWrap}>
            {sexOptions.map(option => (
              <ChoicePill
                key={option}
                label={option}
                active={sex === option}
                onPress={() => setSex(option)}
              />
            ))}
          </View>

          <Text style={styles.sectionLabel}>Role *</Text>
          <View style={styles.optionWrap}>
            {roleOptions.map(option => (
              <ChoicePill
                key={option}
                label={option}
                active={role === option}
                onPress={() => setRole(option)}
              />
            ))}
          </View>

          <AppButton
            title={saving ? 'Saving...' : 'Save Profile'}
            onPress={handleSave}
            loading={saving}
            icon={<Ionicons name="checkmark-circle-outline" size={19} color="#fff" />}
            style={styles.saveButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const Field = ({ label, muted, ...props }: any) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, muted && styles.mutedInput]}
      placeholder={label}
      placeholderTextColor={colors.textSoft}
      {...props}
    />
  </View>
);

const ChoicePill = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.choicePill, active && styles.choicePillActive]} onPress={onPress}>
    <View style={[styles.choiceDot, active && styles.choiceDotActive]} />
    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.textMuted, fontWeight: '700', marginTop: spacing.md },
  formCard: {
    margin: spacing.xl,
    marginTop: -18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  cardSub: { color: colors.textMuted, marginTop: 3, fontSize: 12, fontWeight: '600' },
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', marginBottom: spacing.xs },
  input: {
    minHeight: 52,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  mutedInput: {
    color: colors.textMuted,
    backgroundColor: '#F1F5F9',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choicePillActive: {
    backgroundColor: colors.primarySoft,
    borderColor: '#C7D2FE',
  },
  choiceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.textSoft,
    marginRight: spacing.xs,
  },
  choiceDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  choiceText: { color: colors.textMuted, fontWeight: '800' },
  choiceTextActive: { color: colors.primary },
  saveButton: { marginTop: spacing.xl },
});
