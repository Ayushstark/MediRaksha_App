import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import DateTimePicker from '@react-native-community/datetimepicker';

const TIMES = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
    "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
    "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM"
];

export default function AddAvailability() {
    const router = useRouter();

    const [doctorId, setDoctorId] = useState("");
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [mySlots, setMySlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setFetching(true);
            // 1. Get Doctor Profile
            const docRes = await API.get('/doctor');
            setDoctorId(docRes.data?._id || "");

            // 2. Get My Existing Slots
            const slotsRes = await API.get('/slots/my');
            setMySlots(Array.isArray(slotsRes.data) ? slotsRes.data : []);
        } catch (error) {
            console.error("Failed to fetch initial doctor data:", error);
        } finally {
            setFetching(false);
        }
    };

    const toggleTime = (time: string) => {
        setSelectedTimes(prev =>
            prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
        );
    };

    const handlePublish = async () => {
        if (!doctorId) {
            Alert.alert("Error", "Doctor profile not found.");
            return;
        }
        if (selectedTimes.length === 0) {
            Alert.alert("Selection Required", "Please select at least one time slot.");
            return;
        }

        setLoading(true);
        try {
            // Use local date to avoid timezone shift from toISOString()
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const { data } = await API.post('/slots/create', {
                doctorId,
                date: dateStr,
                times: selectedTimes,
            });

            Alert.alert("Success", data.message || "Slots published successfully!");
            setSelectedTimes([]);
            fetchInitialData(); // Refresh list
        } catch (error: any) {
            console.error("Publish Error:", error.response?.data);
            Alert.alert("Error", error.response?.data?.message || "Failed to publish slots.");
        } finally {
            setLoading(true); // Wait for refresh
            await fetchInitialData();
            setLoading(false);
        }
    };

    const groupedSlots = useMemo(() => {
        // Basic grouping by date for display
        const groups: { [key: string]: string[] } = {};
        mySlots.forEach(doc => {
            (doc.availability || []).forEach((raw: string) => {
                const [d, t] = raw.split('|').map(v => v.trim());
                if (!groups[d]) groups[d] = [];
                groups[d].push(t);
            });
        });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [mySlots]);

    if (fetching) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#1A237E" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1A237E" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Availability</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* ADD NEW SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Add New Slots</Text>

                    <TouchableOpacity
                        style={styles.dateSelector}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color="#1A237E" />
                        <Text style={styles.dateText}>{date.toDateString()}</Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            minimumDate={new Date()}
                            onChange={(e, d) => {
                                setShowDatePicker(false);
                                if (d) setDate(d);
                            }}
                        />
                    )}

                    <Text style={styles.subLabel}>Pick Available Times:</Text>
                    <View style={styles.timeGrid}>
                        {TIMES.map(t => (
                            <TouchableOpacity
                                key={t}
                                style={[styles.timeBtn, selectedTimes.includes(t) && styles.activeTimeBtn]}
                                onPress={() => toggleTime(t)}
                            >
                                <Text style={[styles.timeText, selectedTimes.includes(t) && styles.activeTimeText]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.publishBtn, loading && { opacity: 0.7 }]}
                        onPress={handlePublish}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                                <Text style={styles.publishBtnText}>Publish Slots</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* EXISTING SLOTS SECTION */}
                <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>Current Availability</Text>
                    {groupedSlots.length === 0 ? (
                        <Text style={styles.emptyText}>No slots published yet.</Text>
                    ) : (
                        groupedSlots.map(([d, times]) => (
                            <View key={d} style={styles.slotGroup}>
                                <Text style={styles.slotDate}>{new Date(d).toDateString()}</Text>
                                <View style={styles.badgeContainer}>
                                    {times.map((t, idx) => (
                                        <View key={idx} style={styles.badge}>
                                            <Text style={styles.badgeText}>{t}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 40,
        paddingBottom: 15,
        backgroundColor: '#fff',
        elevation: 2,
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    scrollContent: { padding: 20 },
    section: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 3 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginBottom: 15 },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
    },
    dateText: { marginLeft: 10, fontSize: 16, color: '#1A237E', fontWeight: '500' },
    subLabel: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 10 },
    timeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    timeBtn: {
        width: '48%',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    activeTimeBtn: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
    timeText: { fontSize: 14, color: '#1A237E', fontWeight: '500' },
    activeTimeText: { color: '#fff' },
    publishBtn: {
        flexDirection: 'row',
        backgroundColor: '#10B981',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    publishBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
    slotGroup: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingVertical: 12
    },
    slotDate: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
    badgeContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    badge: {
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 6,
        marginBottom: 6,
    },
    badgeText: { fontSize: 12, color: '#1A237E', fontWeight: '600' },
    emptyText: { textAlign: 'center', color: '#64748B', marginTop: 10, fontStyle: 'italic' },
});
