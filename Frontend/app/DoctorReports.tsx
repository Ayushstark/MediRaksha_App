import React, { useEffect, useState } from 'react';
import {
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/AppUI';
import { useToast } from '../components/ui/ToastProvider';
import {
    getDoctorSharedReports,
    getPatientReportById,
    getPreviewType,
    getReportDataUri,
    MedicalReport,
    PreviewType,
} from '../services/reportsApi';

export default function DoctorReports() {
    const router = useRouter();
    const { showToast } = useToast();
    const [reports, setReports] = useState<MedicalReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
    const [previewUri, setPreviewUri] = useState('');
    const [previewType, setPreviewType] = useState<PreviewType>('other');
    const [previewOpen, setPreviewOpen] = useState(false);

    const fetchReports = async () => {
        try {
            setLoading(true);
            setError('');
            const rows = await getDoctorSharedReports();
            setReports(rows);
        } catch (err: any) {
            console.warn('Error fetching doctor reports:', err?.response?.status || err?.message);
            setError(err?.response?.data?.message || 'Unable to load patient reports shared with you.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const openReport = async (report: MedicalReport) => {
        try {
            setSelectedReport(report);
            const fullReport = await getPatientReportById(report.id);
            if (!fullReport.fileData) {
                showToast({ type: 'error', message: 'Report file data is missing.' });
                return;
            }
            setPreviewType(getPreviewType(fullReport.mimeType, fullReport.originalFileName));
            setPreviewUri(getReportDataUri(fullReport));
            setPreviewOpen(true);
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || 'Could not preview report.' });
        }
    };

    const filteredReports = reports.filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
            (r.title && r.title.toLowerCase().includes(q)) ||
            (r.originalFileName && r.originalFileName.toLowerCase().includes(q)) ||
            (r.category && r.category.toLowerCase().includes(q)) ||
            ((r as any).patientName && (r as any).patientName.toLowerCase().includes(q))
        );
    });

    if (loading) return <LoadingState label="Loading shared patient reports..." />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A237E" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Shared Reports</Text>
                    <Text style={styles.headerSub}>Doctor-visible records assigned to you</Text>
                </View>
                <TouchableOpacity onPress={fetchReports} style={styles.rightBtn}>
                    <MaterialCommunityIcons name="folder-sync" size={24} color="#1A237E" />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#64748B" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search reports by title, category, file..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>

            {error ? (
                <ErrorState title="Unable to load shared reports" subtitle={error} onRetry={fetchReports} />
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    {filteredReports.length === 0 ? (
                        <EmptyState
                            icon="documents-outline"
                            title={searchQuery ? 'No matching reports' : 'No shared records found'}
                            subtitle={searchQuery ? `No reports matched "${searchQuery}"` : 'Patients must upload reports with doctor visibility before they appear here.'}
                        />
                    ) : (
                        filteredReports.map((report) => (
                            <TouchableOpacity key={report.id} style={styles.reportCard} onPress={() => openReport(report)}>
                                <View style={styles.reportInfo}>
                                    <Ionicons name="document-text" size={30} color="#1A237E" />
                                    <View style={{ marginLeft: 15, flex: 1 }}>
                                        <Text style={styles.fileName} numberOfLines={1}>{report.title || report.originalFileName}</Text>
                                        <Text style={styles.patientName}>Category: {report.category || 'other'}</Text>
                                        <Text style={styles.patientName}>Uploaded: {new Date(report.created_at || report.createdAt || '').toLocaleDateString()}</Text>
                                    </View>
                                </View>
                                <View style={styles.actions}>
                                    <TouchableOpacity style={styles.btn} onPress={() => openReport(report)}>
                                        <Text style={styles.btnText}>View</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )}

            <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
                <View style={styles.previewContainer}>
                    <View style={styles.previewHeader}>
                        <TouchableOpacity style={styles.previewButton} onPress={() => setPreviewOpen(false)}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginHorizontal: 14 }}>
                            <Text style={styles.previewTitle} numberOfLines={1}>{selectedReport?.title || 'Patient Report Preview'}</Text>
                            <Text style={styles.previewSubtitle}>{selectedReport?.category || 'other'}</Text>
                        </View>
                    </View>
                    <View style={styles.previewContent}>
                        {previewType === 'image' && (
                            <Image source={{ uri: previewUri }} style={styles.previewImage} contentFit="contain" />
                        )}
                        {previewType === 'pdf' && (
                            <WebView source={{ uri: previewUri }} style={styles.previewWebView} originWhitelist={['*']} startInLoadingState />
                        )}
                        {previewType === 'other' && (
                            <EmptyState title="Preview unavailable" subtitle="This report type cannot be previewed inline." icon="document-outline" />
                        )}
                    </View>
                </View>
            </Modal>
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
    headerSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginHorizontal: 20,
        marginTop: 14,
        marginBottom: 2,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
    scroll: { padding: 20 },
    reportCard: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 15, elevation: 3, borderLeftWidth: 4, borderLeftColor: '#1A237E' },
    reportInfo: { flexDirection: 'row', alignItems: 'center' },
    fileName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    patientName: { fontSize: 12, color: '#666', marginTop: 2 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15 },
    btn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#1A237E', marginLeft: 10 },
    btnText: { color: '#1A237E', fontWeight: 'bold', fontSize: 12 },
    previewContainer: { flex: 1, backgroundColor: '#000' },
    previewHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 18, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.84)' },
    previewButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    previewTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
    previewSubtitle: { color: '#CBD5E1', fontSize: 12, marginTop: 2 },
    previewContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    previewImage: { width: '100%', height: '100%' },
    previewWebView: { width: '100%', flex: 1, backgroundColor: '#000' },
});
