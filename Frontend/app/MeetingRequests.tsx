import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import { LinearGradient } from 'expo-linear-gradient';
import { getDoctorAppointments } from '../services/medirakshaApi';

interface Appointment {
    _id: string;
    patient: {
        name: string;
        age?: number;
        gender?: string;
    };
    date: string;
    startTime: string;
    reason?: string;
    status: 'pending' | 'confirmed' | 'cancelled';
}

const FILTERS = ['all', 'pending', 'confirmed', 'cancelled'];

export default function MeetingRequests() {
    const router = useRouter();
    const [meetings, setMeetings] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [acting, setActing] = useState<string | null>(null);

    const fetchMeetings = async () => {
        try {
            const response = await getDoctorAppointments();
            setMeetings(response || []);
        } catch (error) {
            console.error('Error fetching appointments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
    }, []);

    const handleAction = async (id: string, status: string) => {
        setActing(id);
        try {
            if (status === 'cancelled') {
                await API.delete(`/doctor/meetings/${id}`);
            } else {
                await API.patch(`/doctor/meetings/${id}/status`, { status });
            }
            setMeetings(prev => prev.map(m => m._id === id ? { ...m, status: status as any } : m));
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.msg || 'Action failed');
        } finally {
            setActing(null);
        }
    };

    const filtered = filter === 'all'
        ? meetings
        : meetings.filter(m => m.status === filter);

    const renderBadge = (status: string) => {
        const colors: any = {
            pending: ['#F59E0B', '#D97706'],
            confirmed: ['#10B981', '#059669'],
            cancelled: ['#EF4444', '#DC2626'],
        };
        return (
            <LinearGradient colors={colors[status] || ['#64748B', '#475569']} style={styles.badge}>
                <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
            </LinearGradient>
        );
    };

    const renderItem = ({ item }: { item: Appointment }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.patientInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.patient.name[0]}</Text>
                    </View>
                    <View>
                        <Text style={styles.patientName}>{item.patient.name}</Text>
                        <Text style={styles.dateTime}>
                            {new Date(item.date).toLocaleDateString()} at {item.startTime}
                        </Text>
                    </View>
                </View>
                {renderBadge(item.status)}
            </View>

            <View style={styles.details}>
                <View style={styles.patientMetaRow}>
                    {item.patient.age && (
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Age:</Text>
                            <Text style={styles.metaValue}>{item.patient.age}</Text>
                        </View>
                    )}
                    {item.patient.gender && (
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Gender:</Text>
                            <Text style={styles.metaValue}>{item.patient.gender}</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.reasonLabel}>Reason for visit:</Text>
                <Text style={styles.reasonText}>{item.reason || 'No reason provided'}</Text>
            </View>

            {item.status === 'pending' && (
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.denyBtn]}
                        onPress={() => handleAction(item._id, 'cancelled')}
                        disabled={acting === item._id}
                    >
                        <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                        <Text style={styles.denyText}>Deny</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleAction(item._id, 'confirmed')}
                        disabled={acting === item._id}
                    >
                        {acting === item._id ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                                <Text style={styles.approveText}>Approve</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1A237E" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Appointments</Text>
                </View>
                <TouchableOpacity onPress={fetchMeetings} style={styles.rightBtn}>
                    <Ionicons name="refresh" size={24} color="#1A237E" />
                </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
                    {FILTERS.map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, filter === f && styles.activeChip]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterText, filter === f && styles.activeChipText]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1A237E" style={{ flex: 1 }} />
            ) : (
                <FlatList
                    data={filtered}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FontAwesome5 name="calendar-times" size={60} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No appointments found</Text>
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0'
    },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    rightBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    filterSection: { paddingVertical: 15 },
    filterList: { paddingHorizontal: 20 },
    filterChip: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    activeChip: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
    filterText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
    activeChipText: { color: '#fff' },
    listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    patientInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { fontSize: 18, fontWeight: 'bold', color: '#4F46E5' },
    patientName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
    dateTime: { fontSize: 12, color: '#64748B', marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
    details: { marginTop: 15, padding: 12, backgroundColor: '#F1F5F9', borderRadius: 12 },
    patientMetaRow: { flexDirection: 'row', marginBottom: 10, gap: 15 },
    metaItem: { flexDirection: 'row', alignItems: 'center' },
    metaLabel: { fontSize: 12, color: '#64748B', marginRight: 4 },
    metaValue: { fontSize: 12, fontWeight: '600', color: '#1E293B', textTransform: 'capitalize' },
    reasonLabel: { fontSize: 10, fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase' },
    reasonText: { fontSize: 14, color: '#1E293B', marginTop: 4 },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, gap: 10 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
    denyBtn: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2', borderWidth: 1 },
    approveBtn: { backgroundColor: '#10B981' },
    denyText: { color: '#EF4444', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
    approveText: { color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 14 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 10 },
});
