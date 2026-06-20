import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Image,
    SafeAreaView,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import { LinearGradient } from 'expo-linear-gradient';
import { getDoctors } from '../services/medirakshaApi';

interface Doctor {
    _id: string;
    name: string;
    specialization: string;
    hospital: string;
    experience?: number;
    rating?: number;
}

const SPECIALTIES = ['All', 'General', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics'];

export default function DoctorList() {
    const router = useRouter();
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSpecialty, setSelectedSpecialty] = useState('All');

    const fetchDoctors = async () => {
        try {
            const data = await getDoctors();
            setDoctors(data);
            setFilteredDoctors(data);
        } catch (error) {
            console.error('Error fetching doctors:', error);
            setDoctors([]);
            setFilteredDoctors([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    useEffect(() => {
        let filtered = doctors;
        if (selectedSpecialty !== 'All') {
            filtered = filtered.filter(doc => doc.specialization === selectedSpecialty);
        }
        if (searchQuery) {
            filtered = filtered.filter(doc =>
                doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doc.hospital.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredDoctors(filtered);
    }, [searchQuery, selectedSpecialty, doctors]);

    const openDoctorBooking = (doctor: any) => {
        router.push({
            pathname: '/BookAppointment',
            params: {
                doctorId: doctor.id || doctor._id,
                doctorName: doctor.name,
                directSlot: 'true',
            },
        });
    };

    const renderDoctorCard = ({ item }: { item: Doctor }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => openDoctorBooking(item)}
        >
            <View style={styles.cardContent}>
                <View style={styles.avatarContainer}>
                    <LinearGradient
                        colors={['#4F46E5', '#3730A3']}
                        style={styles.avatarGradient}
                    >
                        <FontAwesome5 name="user-md" size={24} color="#fff" />
                    </LinearGradient>
                </View>
                <View style={styles.infoContainer}>
                    <Text style={styles.docName}>Dr. {item.name}</Text>
                    <Text style={styles.docSpec}>{item.specialization}</Text>
                    <View style={styles.hospitalRow}>
                        <Ionicons name="location-outline" size={14} color="#64748B" />
                        <Text style={styles.docHospital}>{item.hospital}</Text>
                    </View>
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={14} color="#F59E0B" />
                        <Text style={styles.ratingText}>4.8 (120+ reviews)</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => openDoctorBooking(item)}
                >
                    <Text style={styles.bookButtonText}>Book</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1A237E" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Find a Doctor</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Search */}
                <View style={styles.searchSection}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#94A3B8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or hospital..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                </View>

                {/* Specialties */}
                <View style={{ marginBottom: 15 }}>
                    <FlatList
                        data={SPECIALTIES}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.specialtyList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.specialtyChip,
                                    selectedSpecialty === item && styles.activeChip
                                ]}
                                onPress={() => setSelectedSpecialty(item)}
                            >
                                <Text style={[
                                    styles.specialtyText,
                                    selectedSpecialty === item && styles.activeChipText
                                ]}>{item}</Text>
                            </TouchableOpacity>
                        )}
                        keyExtractor={item => item}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#4F46E5" style={{ flex: 1 }} />
                ) : (
                    <FlatList
                        data={filteredDoctors}
                        renderItem={renderDoctorCard}
                        keyExtractor={item => item._id}
                        contentContainerStyle={styles.listContainer}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="doctor" size={60} color="#CBD5E1" />
                                <Text style={styles.emptyText}>No doctors found</Text>
                            </View>
                        }
                    />
                )}
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff'
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A237E' },
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
    specialtyList: { paddingHorizontal: 20 },
    specialtyChip: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#fff',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    activeChip: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    specialtyText: { color: '#64748B', fontWeight: '600' },
    activeChipText: { color: '#fff' },
    listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 15,
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    avatarContainer: { width: 60, height: 60, borderRadius: 15, overflow: 'hidden' },
    avatarGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    infoContainer: { flex: 1, marginLeft: 15 },
    docName: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
    docSpec: { fontSize: 14, color: '#4F46E5', fontWeight: '600', marginTop: 2 },
    hospitalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    docHospital: { fontSize: 13, color: '#64748B', marginLeft: 4 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    ratingText: { fontSize: 12, color: '#94A3B8', marginLeft: 4 },
    bookButton: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 12,
    },
    bookButtonText: { color: '#4F46E5', fontWeight: 'bold', fontSize: 14 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94A3B8', fontSize: 16, marginTop: 10 },
});
