import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';

export default function DoctorReports() {
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await API.get('/doctor/shared-reports');
            setReports(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.warn('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleAnalyze = async (fileId: string) => {
        try {
            Alert.alert('AI Analysis', 'Starting detailed report interpretation...');
            const res = await API.post('/analyze-report', { fileId });
            Alert.alert('Analysis Result', res.data.history || 'Analysis complete.');
        } catch (err) {
            Alert.alert('Error', 'Analysis engine is temporarily busy.');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A237E" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Shared Reports</Text>
                </View>
                <View style={styles.rightBtn}>
                    <MaterialCommunityIcons name="folder-sync" size={24} color="#1A237E" />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {loading ? (
                    <ActivityIndicator size="large" color="#1A237E" style={{ marginTop: 50 }} />
                ) : reports.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="documents-outline" size={60} color="#ccc" />
                        <Text style={styles.emptyText}>No patient reports shared with you yet.</Text>
                    </View>
                ) : (
                    reports.map((r, i) => (
                        <View key={i} style={styles.reportCard}>
                            <View style={styles.reportInfo}>
                                <Ionicons name="document-text" size={30} color="#1A237E" />
                                <View style={{ marginLeft: 15 }}>
                                    <Text style={styles.fileName}>{r.fileName || 'Medical_Report.pdf'}</Text>
                                    <Text style={styles.patientName}>By: {r.patientName || 'Anonymous'}</Text>
                                </View>
                            </View>
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('Download', 'Opening secure PDF viewer...')}>
                                    <Text style={styles.btnText}>View</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, styles.aiBtn]} onPress={() => handleAnalyze(r.fileId)}>
                                    <Ionicons name="sparkles" size={14} color="#fff" />
                                    <Text style={[styles.btnText, { color: '#fff', marginLeft: 5 }]}>AI Review</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FF' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, paddingTop: Platform.OS === 'ios' ? 50 : 20, backgroundColor: '#fff', elevation: 2 },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    rightBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    scroll: { padding: 20 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#999', marginTop: 15, fontSize: 16 },
    reportCard: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 15, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#1A237E' },
    reportInfo: { flexDirection: 'row', alignItems: 'center' },
    fileName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    patientName: { fontSize: 12, color: '#666', marginTop: 2 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15 },
    btn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#1A237E', marginLeft: 10 },
    aiBtn: { backgroundColor: '#1A237E', flexDirection: 'row', alignItems: 'center' },
    btnText: { color: '#1A237E', fontWeight: 'bold', fontSize: 12 }
});
