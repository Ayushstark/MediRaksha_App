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
import { login } from '../services/auth';
import API from '../apiClient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function DoctorLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Email and password are required');
            return;
        }

        try {
            setLoading(true);
            // 🔐 DOCTOR LOGIN
            await login(email.trim(), password, 'Doctor');

            // Always redirect to Doctor Dashboard after login
            router.replace('/DoctorDashboard');
        } catch (error: any) {
            console.error('Doctor login error:', error);
            Alert.alert(
                'Access Denied',
                error.response?.data?.detail || error.response?.data?.msg || error.response?.data?.message || 'Invalid email or password. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#F8FAFC', '#E0E7FF']} style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Animated.View entering={FadeInDown.delay(200)} style={styles.headerSection}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color="#1E293B" />
                        </TouchableOpacity>
                        <View style={styles.iconContainer}>
                            <LinearGradient colors={['#4F46E5', '#3730A3']} style={styles.iconCircle}>
                                <FontAwesome5 name="user-md" size={40} color="#fff" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.title}>Doctor Portal</Text>
                        <Text style={styles.subtitle}>Welcome back, please login to your account</Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(400)} style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="email-address"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#4F46E5', '#3730A3']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientBtn}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.loginText}>Sign In</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/Signup')}>
                            <Text style={styles.signupText}>
                                Not registered yet? <Text style={styles.signupHighlight}>Apply for Verification</Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Secure Access for Verified Professionals</Text>
                        <View style={styles.footerLine} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
    headerSection: { alignItems: 'center', marginBottom: 40 },
    backBtn: { position: 'absolute', left: 0, top: 0, padding: 8 },
    iconContainer: { marginBottom: 20 },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    title: { fontSize: 32, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center' },
    formSection: { gap: 20 },
    inputGroup: { gap: 8 },
    label: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 60,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: '#1E293B' },
    loginButton: { height: 60, borderRadius: 16, overflow: 'hidden', marginTop: 10, elevation: 5 },
    gradientBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loginText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    signupLink: { alignItems: 'center', marginTop: 10 },
    signupText: { fontSize: 14, color: '#64748B' },
    signupHighlight: { color: '#4F46E5', fontWeight: 'bold' },
    footer: { marginTop: 'auto', alignItems: 'center', paddingTop: 40 },
    footerText: { fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
    footerLine: { width: 40, height: 2, backgroundColor: '#E2E8F0', marginTop: 8 },
});
