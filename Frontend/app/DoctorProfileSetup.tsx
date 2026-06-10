import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentProfile } from '../services/medirakshaApi';

export default function DoctorProfileSetup() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        doctorId: '',
        name: '',
        age: '',
        hospital: '',
        specialization: '',
    });

    const fetchProfile = async () => {
        try {
            const data = await getCurrentProfile('Doctor');
            setFormData({
                doctorId: data.doctorId || data.id || '',
                name: data.name || '',
                age: data.age?.toString() || '',
                hospital: data.hospital || '',
                specialization: data.specialization || data.speciality || '',
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

    const handleSave = async () => {
        if (!formData.name || !formData.hospital || !formData.specialization) {
            Alert.alert('Required Fields', 'Please fill in name, hospital, and specialization.');
            return;
        }

        setSaving(true);
        try {
            await API.patch('/doctor/info/update', {
                name: formData.name,
                hospital: formData.hospital,
                speciality: formData.specialization,
                age: parseInt(formData.age) || 0,
            });
            Alert.alert('Success', 'Profile updated successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            Alert.alert('Update Failed', error.response?.data?.msg || 'Could not update profile.');
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
                behavior={Platform.OS === "ios" ? "padding" : undefined} 
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="close" size={28} color="#1A237E" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>Edit Profile</Text>
                        </View>
                        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.rightBtn}>
                            {saving ? (
                                <ActivityIndicator size="small" color="#1A237E" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.avatarSection}>
                        <LinearGradient colors={['#4F46E5', '#3730A3']} style={styles.avatarCircle}>
                            <FontAwesome5 name="user-md" size={50} color="#fff" />
                        </LinearGradient>
                        <TouchableOpacity style={styles.changePicBtn}>
                            <Text style={styles.changePicText}>Change Profile Picture</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        <InputGroup
                            label="Doctor ID (Unique)"
                            value={formData.doctorId}
                            editable={false}
                            icon="id-card"
                        />
                        <InputGroup
                            label="Full Name"
                            value={formData.name}
                            onChangeText={(t: string) => setFormData({ ...formData, name: t })}
                            placeholder="Dr. John Doe"
                            icon="user"
                        />
                        <InputGroup
                            label="Age"
                            value={formData.age}
                            onChangeText={(t: string) => setFormData({ ...formData, age: t })}
                            placeholder="35"
                            keyboardType="numeric"
                            icon="birthday-cake"
                        />
                        <InputGroup
                            label="Hospital / Clinic"
                            value={formData.hospital}
                            onChangeText={(t: string) => setFormData({ ...formData, hospital: t })}
                            placeholder="City General Hospital"
                            icon="hospital"
                        />
                        <InputGroup
                            label="Specialization"
                            value={formData.specialization}
                            onChangeText={(t: string) => setFormData({ ...formData, specialization: t })}
                            placeholder="Cardiologist"
                            icon="stethoscope"
                        />
                    </View>

                    <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/Login')}>
                        <MaterialIcons name="logout" size={20} color="#EF4444" />
                        <Text style={styles.logoutText}>Sign Out</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const InputGroup = ({ label, icon, ...props }: any) => (
    <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.inputContainer, !props.editable && props.editable !== undefined && styles.disabledInput]}>
            <FontAwesome5 name={icon} size={16} color="#94A3B8" style={styles.inputIcon} />
            <TextInput style={styles.input} {...props} placeholderTextColor="#94A3B8" />
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { width: 60, height: 44, justifyContent: 'center' },
    rightBtn: { width: 60, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    saveBtnText: { fontSize: 16, fontWeight: 'bold', color: '#4F46E5' },
    avatarSection: { alignItems: 'center', marginVertical: 30 },
    avatarCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    changePicBtn: { marginTop: 15 },
    changePicText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
    form: { paddingHorizontal: 25 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 15
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, height: 50, fontSize: 16, color: '#1E293B' },
    disabledInput: { backgroundColor: '#F1F5F9', borderStyle: 'dashed' },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
        padding: 15
    },
    logoutText: { color: '#EF4444', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
});
