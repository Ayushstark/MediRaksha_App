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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

export default function LoginScreen() {
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
            // 🔐 PATIENT LOGIN
            await login(email.trim(), password, 'Patient');
            console.log('--- Login Successful. Token saved to SecureStore.');
            router.replace('/PatientDashboard');
        } catch (error: any) {
            console.error('Login error:', error);
            Alert.alert(
                'Access Denied',
                error.response?.data?.detail || error.response?.data?.msg || error.response?.data?.message || 'Invalid credentials. Please try again.'
            );
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
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Animated.View entering={FadeInDown.delay(200)} style={styles.headerSection}>
                        <View style={styles.iconContainer}>
                            <LinearGradient colors={['#1A237E', '#3949AB']} style={styles.iconCircle}>
                                <FontAwesome5 name="hospital-user" size={40} color="#fff" />
                            </LinearGradient>
                        </View>
                        <Text style={styles.title}>Patient Portal</Text>
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
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
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
                                colors={['#1A237E', '#3949AB']}
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

                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.divider} />
                        </View>

                        <TouchableOpacity
                            style={styles.doctorButton}
                            onPress={() => router.push('/DoctorLogin')}
                        >
                            <Ionicons name="medical-outline" size={20} color="#1A237E" style={{ marginRight: 8 }} />
                            <Text style={styles.doctorButtonText}>Doctor Portal</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/Signup')}>
                            <Text style={styles.signupText}>
                                Don't have an account? <Text style={styles.signupHighlight}>Sign Up</Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>MediRaksha • Your Health, Our Priority</Text>
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
    iconContainer: { marginBottom: 20 },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#1A237E',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    title: { fontSize: 32, fontWeight: '800', color: '#1A237E', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center' },
    formSection: { gap: 15 },
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
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
    divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
    dividerText: { marginHorizontal: 12, color: '#94A3B8', fontWeight: '600', fontSize: 12 },
    doctorButton: {
        flexDirection: 'row',
        height: 60,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#1A237E',
        backgroundColor: 'rgba(26, 35, 126, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    doctorButtonText: { color: '#1A237E', fontSize: 16, fontWeight: 'bold' },
    signupLink: { alignItems: 'center', marginTop: 10 },
    signupText: { fontSize: 14, color: '#64748B' },
    signupHighlight: { color: '#1A237E', fontWeight: 'bold' },
    footer: { marginTop: 'auto', alignItems: 'center', paddingTop: 40 },
    footerText: { fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
    footerLine: { width: 40, height: 2, backgroundColor: '#E2E8F0', marginTop: 8 },
});
