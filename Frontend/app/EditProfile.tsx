import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import API from '../apiClient';
import { useRouter } from 'expo-router';
import { getCurrentProfile } from '../services/medirakshaApi';

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

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const userData = await getCurrentProfile('Patient');

        // Basic role detection from data if possible, default to Patient
        setRole(userData.role || 'Patient');

        if (userData) {
          setName(userData.name || '');
          setEmail(userData.email || userData.doctorId || '');
          setAge(userData.age ? String(userData.age) : '');
          setSex(userData.gender || '');
          setPhone(userData.phoneNumber || userData.number || '');
        }
      } catch (error: any) {
        Alert.alert('Error', 'Failed to load profile. Please login again.');
        router.replace('/Login');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Save profile handler
  const handleSave = async () => {
    if (!name.trim() || !sex.trim()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    try {
      setSaving(true);
      await API.patch('/user/info/update', {
        name: name.trim(),
        gender: sex.trim(),
        age: Number(age),
        number: phone.trim()
      });

      Alert.alert('Success', 'Profile updated successfully!');
      router.replace(role === 'Doctor' ? '/DoctorDashboard' : '/PatientDashboard');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.msg || error.message || 'Failed to update profile');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>Edit Profile</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name *"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          placeholder="Email *"
          value={email}
          editable={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Age"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
        />

        <Text style={styles.sectionLabel}>Sex *</Text>
        <View style={styles.radioGroup}>
          {sexOptions.map(option => (
            <TouchableOpacity
              key={option}
              style={styles.radioOption}
              onPress={() => setSex(option)}
            >
              <View
                style={[
                  styles.radioDot,
                  sex === option && styles.radioDotSelected,
                ]}
              />
              <Text style={styles.radioLabel}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Role *</Text>
        <View style={styles.radioGroup}>
          {roleOptions.map(option => (
            <TouchableOpacity
              key={option}
              style={styles.radioOption}
              onPress={() => setRole(option)}
            >
              <View
                style={[
                  styles.radioDot,
                  role === option && styles.radioDotSelected,
                ]}
              />
              <Text style={styles.radioLabel}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButton}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#E8F5E9',
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 30,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
    color: '#1A237E',
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1A237E',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  radioDotSelected: {
    backgroundColor: '#1A237E',
  },
  radioLabel: {
    fontSize: 16,
    color: '#1A237E',
  },
  saveButton: {
    backgroundColor: '#1A237E',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
