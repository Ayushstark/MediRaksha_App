import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppChip, EmptyState } from '../components/ui/AppUI';
import { colors, radius, shadows, spacing } from '../constants/theme';
import { getDoctors } from '../services/medirakshaApi';

interface Doctor {
    _id: string;
    id?: string;
    name: string;
    specialization: string;
    specialty?: string;
    hospital: string;
    experience?: number;
    rating?: number;
    availableSlots?: {
        id?: string;
        _id?: string;
        bookingDate?: string;
        date?: string;
        slotTime?: string;
        time?: string;
        status?: string;
    }[];
}

const SPECIALTIES = ['All', 'General', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics'];

export default function DoctorList() {
    const router = useRouter();
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState('All');

    const fetchDoctors = async () => {
        try {
            const data = await getDoctors();
            setDoctors(data);
        } catch (error) {
            console.warn('Doctor discovery unavailable:', error);
            setDoctors([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    const filteredDoctors = useMemo(() => {
        let filtered = doctors;
        if (selectedSpecialty !== 'All') {
            filtered = filtered.filter(doc =>
                String(doc.specialization || doc.specialty || '').toLowerCase().includes(selectedSpecialty.toLowerCase())
            );
        }
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(doc =>
                String(doc.name || '').toLowerCase().includes(query) ||
                String(doc.hospital || '').toLowerCase().includes(query) ||
                String(doc.specialization || doc.specialty || '').toLowerCase().includes(query)
            );
        }
        return filtered;
    }, [searchQuery, selectedSpecialty, doctors]);

    const openDoctorBooking = (doctor: Doctor) => {
        router.push({
            pathname: '/DoctorDetails',
            params: {
                doctorId: doctor.id || doctor._id,
                doctorName: doctor.name,
                specialty: doctor.specialization || doctor.specialty,
                hospitalName: doctor.hospital,
                availability: JSON.stringify(doctor.availableSlots || []),
                directSlot: 'true',
            },
        });
    };

    const renderDoctorCard = ({ item }: { item: Doctor }) => {
        const availableSlots = (item.availableSlots || []).filter(slot => slot.status !== 'booked');
        const previewSlots = availableSlots.slice(0, 3);
        const specialization = item.specialization || item.specialty || 'General Physician';

        return (
            <TouchableOpacity style={styles.card} onPress={() => openDoctorBooking(item)} activeOpacity={0.86}>
                <View style={styles.cardTop}>
                    <LinearGradient colors={['#1A237E', '#3762F0']} style={styles.avatar}>
                        <FontAwesome5 name="user-md" size={22} color="#fff" />
                    </LinearGradient>
                    <View style={styles.cardInfo}>
                        <Text style={styles.docName}>Dr. {item.name}</Text>
                        <Text style={styles.docSpec}>{specialization}</Text>
                        <View style={styles.metaRow}>
                            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                            <Text style={styles.docHospital} numberOfLines={1}>{item.hospital || 'MediRaksha Clinic'}</Text>
                        </View>
                    </View>
                    <View style={styles.ratingPill}>
                        <Ionicons name="star" size={13} color={colors.warning} />
                        <Text style={styles.ratingText}>{item.rating || '4.8'}</Text>
                    </View>
                </View>

                <View style={styles.slotPanel}>
                    <View style={styles.slotSummary}>
                        <Ionicons name="time-outline" size={16} color={availableSlots.length ? colors.success : colors.textSoft} />
                        <Text style={[styles.slotSummaryText, !availableSlots.length && styles.noSlotText]}>
                            {availableSlots.length ? `${availableSlots.length} published slot${availableSlots.length > 1 ? 's' : ''}` : 'No published slots'}
                        </Text>
                    </View>

                    {previewSlots.length > 0 && (
                        <View style={styles.slotChipRow}>
                            {previewSlots.map(slot => (
                                <View key={slot.id || slot._id || `${slot.bookingDate}-${slot.slotTime}`} style={styles.slotChip}>
                                    <Text style={styles.slotChipText}>
                                        {(slot.bookingDate || slot.date || '').slice(5)} {slot.slotTime || slot.time}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.footerHint}>Tap to select consultation type and slot</Text>
                    <View style={styles.bookButton}>
                        <Text style={styles.bookButtonText}>Book</Text>
                        <Ionicons name="chevron-forward" size={15} color="#fff" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.container}>
                <LinearGradient colors={['#1A237E', '#3762F0']} style={styles.header}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={22} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerEyebrow}>Doctor Discovery</Text>
                        <View style={{ width: 42 }} />
                    </View>
                    <Text style={styles.headerTitle}>Find the right care</Text>
                    <Text style={styles.headerSub}>Search by doctor, hospital, or speciality and book from published slots.</Text>
                </LinearGradient>

                <View style={styles.searchCard}>
                    <Ionicons name="search" size={20} color={colors.textSoft} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search doctor, hospital, speciality..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={colors.textSoft}
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color={colors.textSoft} />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <FlatList
                    data={SPECIALTIES}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.specialtyList}
                    renderItem={({ item }) => (
                        <AppChip
                            label={item}
                            active={selectedSpecialty === item}
                            onPress={() => setSelectedSpecialty(item)}
                        />
                    )}
                    keyExtractor={item => item}
                />

                {loading ? (
                    <View style={styles.loadingBlock}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Finding available doctors...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredDoctors}
                        renderItem={renderDoctorCard}
                        keyExtractor={item => String(item.id || item._id)}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <EmptyState
                                icon="medical-outline"
                                title="No doctors found"
                                subtitle="Try a different speciality, doctor name, or hospital."
                            />
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        paddingTop: 18,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xxl,
        borderBottomLeftRadius: radius.xl,
        borderBottomRightRadius: radius.xl,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: {
        width: 42,
        height: 42,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '800' },
    headerTitle: { color: '#fff', fontSize: 29, fontWeight: '900', marginTop: spacing.xl },
    headerSub: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
    searchCard: {
        marginHorizontal: spacing.xl,
        marginTop: -26,
        minHeight: 56,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
    },
    searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: 15, color: colors.text, fontWeight: '700' },
    specialtyList: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
    listContainer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    loadingBlock: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.textMuted, fontWeight: '700', marginTop: spacing.md },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 58, height: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    cardInfo: { flex: 1, marginLeft: spacing.md },
    docName: { fontSize: 18, fontWeight: '900', color: colors.text },
    docSpec: { fontSize: 13, color: colors.primary, fontWeight: '800', marginTop: 3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
    docHospital: { fontSize: 12, color: colors.textMuted, marginLeft: 4, flex: 1, fontWeight: '600' },
    ratingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warningSoft,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    ratingText: { color: colors.text, marginLeft: 4, fontSize: 12, fontWeight: '900' },
    slotPanel: { marginTop: spacing.lg, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md },
    slotSummary: { flexDirection: 'row', alignItems: 'center' },
    slotSummaryText: { color: colors.success, marginLeft: spacing.xs, fontSize: 13, fontWeight: '900' },
    noSlotText: { color: colors.textSoft },
    slotChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
    slotChip: { backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    slotChipText: { color: '#047857', fontSize: 11, fontWeight: '800' },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
    footerHint: { color: colors.textMuted, fontSize: 12, flex: 1, paddingRight: spacing.md },
    bookButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    bookButtonText: { color: '#fff', fontWeight: '900', marginRight: 4 },
});
