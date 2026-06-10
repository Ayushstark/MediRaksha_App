import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    Alert,
} from 'react-native';
import { Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import { LinearGradient } from 'expo-linear-gradient';
import { getDoctorPatients } from '../services/medirakshaApi';

interface Patient {
    _id: string;
    name: string;
    age?: number;
    gender?: string;
    email?: string;
    appointments?: any[];
}

export default function MyPatients() {
    const router = useRouter();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    const fetchPatients = async () => {
        try {
            const response = await getDoctorPatients();
            setPatients(response || []);
            setFilteredPatients(response || []);
        } catch (error) {
            console.error('Error fetching patients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    useEffect(() => {
        if (searchQuery) {
            const filtered = patients.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.email?.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredPatients(filtered);
        } else {
            setFilteredPatients(patients);
        }
    }, [searchQuery, patients]);

    const toggleExpand = (id: string) => {
        setExpanded(expanded === id ? null : id);
    };

    const renderPatientCard = ({ item }: { item: Patient }) => {
        const isExpanded = expanded === item._id;
        return (
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => toggleExpand(item._id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.patientMain}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{item.name[0]}</Text>
                        </View>
                        <View>
                            <Text style={styles.patientName}>{item.name}</Text>
                            <Text style={styles.patientMeta}>
                                {item.age} yrs • {item.gender}
                            </Text>
                        </View>
                    </View>
                    <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#94A3B8"
                    />
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.expandedContent}>
                        <View style={styles.divider} />
                        <View style={styles.infoRow}>
                            <Feather name="mail" size={14} color="#64748B" />
                            <Text style={styles.infoText}>{item.email || 'No email provided'}</Text>
                        </View>

                        <View style={styles.historySection}>
                            <Text style={styles.historyTitle}>Appointment History</Text>
                            {item.appointments && item.appointments.length > 0 ? (
                                item.appointments.map((appt, idx) => (
                                    <View key={idx} style={styles.historyItem}>
                                        <View style={styles.historyDot} />
                                        <Text style={styles.historyDate}>
                                            {new Date(appt.date).toLocaleDateString()}
                                        </Text>
                                        <Text style={styles.historyStatus}>{appt.status}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.noHistory}>No previous records found.</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.detailsBtn}
                            onPress={() => Alert.alert('Patient Info', 'Redirecting to full patient records...')}
                        >
                            <Text style={styles.detailsBtnText}>View Full Medical Records</Text>
                            <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A237E" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>My Patients</Text>
                </View>
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>{patients.length}</Text>
                </View>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search patients..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1A237E" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={filteredPatients}
                    renderItem={renderPatientCard}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome5 name="users-slash" size={60} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No patients found</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0'
    },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    countBadge: { backgroundColor: '#E0E7FF', width: 44, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    countText: { color: '#4F46E5', fontWeight: 'bold', fontSize: 14 },
    searchSection: { padding: 20 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 15,
        paddingHorizontal: 15,
        height: 50,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1E293B' },
    listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        overflow: 'hidden',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
    patientMain: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    patientName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    patientMeta: { fontSize: 13, color: '#64748B', marginTop: 2 },
    expandedContent: { padding: 15, paddingTop: 0 },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 15 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    infoText: { fontSize: 14, color: '#64748B', marginLeft: 10 },
    historySection: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 15 },
    historyTitle: { fontSize: 11, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 },
    historyItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    historyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 10 },
    historyDate: { fontSize: 13, color: '#1E293B', flex: 1 },
    historyStatus: { fontSize: 12, color: '#64748B' },
    noHistory: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },
    detailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A237E',
        padding: 12,
        borderRadius: 12
    },
    detailsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginRight: 8 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 10 },
});
