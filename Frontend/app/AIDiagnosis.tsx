import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import API from '../apiClient';

const displayText = (value: any, fallback = 'Not available'): string => {
    if (typeof value === 'string') return value.trim() || fallback;
    if (Array.isArray(value)) return value.map(item => displayText(item, '')).filter(Boolean).join('\n');
    if (value && typeof value === 'object') {
        return Object.entries(value)
            .map(([key, item]) => `${key.replace(/[_-]+/g, ' ')}: ${displayText(item, '')}`)
            .filter(line => !line.endsWith(': '))
            .join('\n') || fallback;
    }
    return value == null ? fallback : String(value);
};

export default function AIDiagnosis() {
    const router = useRouter();
    const [symptoms, setSymptoms] = useState('');
    const [loading, setLoading] = useState(false);
    const [diagnosis, setDiagnosis] = useState<any>(null);

    const handleAnalyze = async () => {
        if (!symptoms.trim()) {
            Alert.alert('Error', 'Please describe your symptoms first.');
            return;
        }

        setLoading(true);
        setDiagnosis(null);

        try {
            const response = await API.post('/diagnoses', { symptoms });
            setDiagnosis(response.data);
        } catch (error: any) {
            console.error('Groq Error:', error);
            Alert.alert('AI Error', error.response?.data?.detail || 'Could not process symptoms. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#1A237E" /></TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>MediRaksha AI</Text>
                </View>
                <View style={styles.rightBtn}>
                    <MaterialCommunityIcons name="robot" size={24} color="#1A237E" />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.title}>What symptoms are you experiencing?</Text>
                <Text style={styles.subtitle}>Describe how you feel in detail for a more accurate assessment.</Text>

                <TextInput
                    style={styles.input}
                    placeholder="e.g. I have a sharp pain in my upper abdomen and feel nauseous since morning."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={6}
                    value={symptoms}
                    onChangeText={setSymptoms}
                />

                <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>Analyze symptoms with AI</Text>}
                </TouchableOpacity>

                {diagnosis && (
                    <Animated.View entering={FadeIn} style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                            <Ionicons name="medical" size={24} color="#1A237E" />
                            <Text style={styles.resultTitle}>Preliminary Diagnosis</Text>
                        </View>

                        <View style={styles.item}>
                            <Text style={styles.label}>Condition:</Text>
                            <Text style={styles.value}>{displayText(diagnosis.condition)}</Text>
                        </View>

                        <View style={styles.item}>
                            <Text style={styles.label}>Severity:</Text>
                            <Text style={[styles.value, { color: diagnosis.severity?.toLowerCase() === 'high' ? '#D32F2F' : '#2E7D32' }]}>
                                {displayText(diagnosis.severity)}
                            </Text>
                        </View>

                        <View style={styles.item}>
                            <Text style={styles.label}>Recommended Specialist:</Text>
                            <Text style={styles.value}>{displayText(diagnosis.specialist)}</Text>
                        </View>

                        <View style={styles.adviceBox}>
                            <Text style={styles.adviceTitle}>Advice:</Text>
                            <Text style={styles.adviceText}>{displayText(diagnosis.advice)}</Text>
                        </View>

                        <Text style={styles.disclaimer}>
                            * This is an AI-generated assessment and not a medical diagnosis. Please consult a qualified doctor.
                        </Text>
                    </Animated.View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F4FF' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, paddingTop: 50, backgroundColor: '#fff', elevation: 2 },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    rightBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    scroll: { padding: 20 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1A237E', marginTop: 10 },
    subtitle: { fontSize: 14, color: '#666', marginTop: 8, marginBottom: 20 },
    input: { backgroundColor: '#fff', borderRadius: 15, padding: 15, fontSize: 16, color: '#333', textAlignVertical: 'top', elevation: 2, borderWidth: 1, borderColor: '#E8F0FE', minHeight: 120 },
    analyzeBtn: { backgroundColor: '#1A237E', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 20, elevation: 4 },
    analyzeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    resultCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginTop: 30, elevation: 6, borderLeftWidth: 5, borderLeftColor: '#1A237E' },
    resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    resultTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginLeft: 10 },
    item: { marginBottom: 12 },
    label: { fontSize: 12, color: '#777', fontWeight: '600', textTransform: 'uppercase' },
    value: { fontSize: 16, color: '#333', fontWeight: 'bold', marginTop: 2 },
    adviceBox: { backgroundColor: '#E8EAF6', padding: 15, borderRadius: 12, marginTop: 10 },
    adviceTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A237E', marginBottom: 5 },
    adviceText: { fontSize: 14, color: '#333', lineHeight: 20 },
    disclaimer: { fontSize: 10, color: '#999', marginTop: 20, fontStyle: 'italic', textAlign: 'center' }
});
