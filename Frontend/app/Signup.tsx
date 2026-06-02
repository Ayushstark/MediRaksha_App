import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signup } from '../services/auth';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const sexOptions = ['Male', 'Female', 'Other'];
const roleOptions = ['Patient', 'Doctor'];

export default function SignupScreen() {
    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [age, setAge] = useState('');
    const [sex, setSex] = useState('');
    const [role, setRole] = useState('');
    const [loading, setLoading] = useState(false);

    const router = useRouter();

    const handleSignup = async () => {
        if (!fullname || !email || !phone || !password || !age || !sex || !role) {
            Alert.alert('Error', 'All fields are required');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters');
            return;
        }

        try {
            setLoading(true);

            // ✅ SIGNUP VIA NODE.JS BACKEND
            await signup(
                email.trim().toLowerCase(),
                password,
                fullname.trim(),
                role,
                Number(age),
                sex,
                phone.trim()
            );

            Alert.alert(
                'Signup Successful',
                'Your account has been created. Please login to continue.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.replace(role === 'Doctor' ? '/DoctorLogin' : '/Login'),
                    },
                ]
            );
        } catch (e: any) {
            console.error('Signup error:', e);
            Alert.alert('Signup Failed', e.response?.data?.detail || e.response?.data?.message || e.message || 'Please try again');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#F8FAFC', '#E8F5E9']} style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Animated.View entering={FadeInDown.delay(200)} style={styles.headerSection}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#1A237E" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join MediRaksha for better health management</Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(400)} style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your full name"
                                    placeholderTextColor="#94A3B8"
                                    value={fullname}
                                    onChangeText={setFullname}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone Number</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="call-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your phone number"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                                <Text style={styles.label}>Age</Text>
                                <View style={styles.inputWrapper}>
                                    <MaterialCommunityIcons name="calendar-range" size={20} color="#64748B" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Age"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="numeric"
                                        value={age}
                                        onChangeText={setAge}
                                    />
                                </View>
                            </View>

                            <View style={[styles.inputGroup, { flex: 1.5 }]}>
                                <Text style={styles.label}>Gender</Text>
                                <View style={styles.selectorContainer}>
                                    {sexOptions.map(o => (
                                        <TouchableOpacity
                                            key={o}
                                            style={[styles.selectorBtn, sex === o && styles.activeSelector]}
                                            onPress={() => setSex(o)}
                                        >
                                            <Text style={[styles.selectorText, sex === o && styles.activeSelectorText]}>{o}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Min 8 characters"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>I am a...</Text>
                            <View style={styles.selectorContainer}>
                                {roleOptions.map(o => (
                                    <TouchableOpacity
                                        key={o}
                                        style={[styles.selectorBtn, { flex: 1 }, role === o && styles.activeSelector]}
                                        onPress={() => setRole(o)}
                                    >
                                        <FontAwesome5
                                            name={o === 'Doctor' ? 'user-md' : 'user-injured'}
                                            size={16}
                                            color={role === o ? '#fff' : '#1A237E'}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text style={[styles.selectorText, role === o && styles.activeSelectorText]}>{o}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.signupButton, loading && { opacity: 0.7 }]}
                            onPress={handleSignup}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#1A237E', '#3949AB']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientBtn}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.signupTextBtn}>Sign Up</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/Login')}>
                            <Text style={styles.loginText}>
                                Already have an account? <Text style={styles.loginHighlight}>Login</Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Secure Registration Powered by MediRaksha</Text>
                        <View style={styles.footerLine} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 40 },
    headerSection: { alignItems: 'center', marginBottom: 30, paddingTop: 20 },
    backBtn: { position: 'absolute', left: 0, top: 20, padding: 8 },
    title: { fontSize: 32, fontWeight: '800', color: '#1A237E', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center' },
    formSection: { gap: 12 },
    inputGroup: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 16,
        height: 54,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: '#1E293B' },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    selectorContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 54,
    },
    selectorBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        flexDirection: 'row',
    },
    activeSelector: { backgroundColor: '#1A237E' },
    selectorText: { fontSize: 13, fontWeight: '600', color: '#1A237E' },
    activeSelectorText: { color: '#fff' },
    signupButton: { height: 56, borderRadius: 14, overflow: 'hidden', marginTop: 10, elevation: 4 },
    gradientBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    signupTextBtn: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
    loginLink: { alignItems: 'center', marginTop: 10 },
    loginText: { fontSize: 14, color: '#64748B' },
    loginHighlight: { color: '#1A237E', fontWeight: 'bold' },
    footer: { marginTop: 40, alignItems: 'center' },
    footerText: { fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
    footerLine: { width: 30, height: 2, backgroundColor: '#E2E8F0', marginTop: 6 },
});
