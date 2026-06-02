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
    TextInput,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import DateTimePicker from '@react-native-community/datetimepicker';

const TIMES = [
    "09:00 - 09:15",
    "09:15 - 09:30",
    "09:30 - 09:45",
    "10:00 - 10:15",
    "10:15 - 10:30",
    "10:30 - 10:45",
    "11:00 - 11:15",
    "11:15 - 11:30",
    "11:30 - 11:45",
    "12:00 - 12:15",
    "12:15 - 12:30",
    "12:30 - 12:45",
    "02:00 - 02:15",
    "02:15 - 02:30",
    "02:30 - 02:45",
];

const WEEKDAYS = [
    { label: 'Mon', value: 0 },
    { label: 'Tue', value: 1 },
    { label: 'Wed', value: 2 },
    { label: 'Thu', value: 3 },
    { label: 'Fri', value: 4 },
    { label: 'Sat', value: 5 },
    { label: 'Sun', value: 6 },
];

export default function AddAvailability() {
    const router = useRouter();

    const [doctorId, setDoctorId] = useState("");
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
    const [mySlots, setMySlots] = useState<any[]>([]);
    const [publishMode, setPublishMode] = useState<'single' | 'weekly'>('single');
    const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
    const [weeks, setWeeks] = useState('4');
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
            const slotsRes = await API.get('/slots/my/details');
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

    const toggleWeekday = (weekday: number) => {
        setSelectedWeekdays(prev =>
            prev.includes(weekday) ? prev.filter(d => d !== weekday) : [...prev, weekday]
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
        if (publishMode === 'weekly' && selectedWeekdays.length === 0) {
            Alert.alert("Selection Required", "Please select at least one weekday.");
            return;
        }

        setLoading(true);
        try {
            // Prevent timezone shift by adjusting for local offset before converting to ISODate
            const offset = date.getTimezoneOffset();
            const localDate = new Date(date.getTime() - (offset * 60 * 1000));
            const dateStr = localDate.toISOString().split('T')[0];

            const payload = {
                doctorId,
                times: selectedTimes,
                ...(publishMode === 'weekly'
                    ? { startDate: dateStr, weekdays: selectedWeekdays, weeks: Math.max(1, Math.min(parseInt(weeks) || 1, 12)) }
                    : { date: dateStr }),
            };

            const { data } = await API.post(publishMode === 'weekly' ? '/slots/create-weekly' : '/slots/create', payload);

            Alert.alert("Success", data.message || "Slots published successfully!");
            setSelectedTimes([]);
            setSelectedWeekdays([]);
            fetchInitialData(); // Refresh list
        } catch (error: any) {
            console.error("Publish Error:", error.response?.data);
            Alert.alert("Error", error.response?.data?.detail || error.response?.data?.message || "Failed to publish slots.");
        } finally {
            setLoading(true); // Wait for refresh
            await fetchInitialData();
            setLoading(false);
        }
    };

    const cancelSlot = async (slotId: string) => {
        Alert.alert('Cancel Slot', 'Patients will no longer see this slot as available.', [
            { text: 'Keep', style: 'cancel' },
            {
                text: 'Cancel Slot',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await API.delete(`/slots/${slotId}`);
                        await fetchInitialData();
                    } catch (error: any) {
                        Alert.alert('Error', error.response?.data?.detail || 'Could not cancel slot.');
                    }
                },
            },
        ]);
    };

    const groupedSlots = useMemo(() => {
        const groups: { [key: string]: string[] } = {};
        mySlots
            .filter(slot => slot.status === 'available')
            .forEach((slot: any) => {
                if (!groups[slot.date]) groups[slot.date] = [];
                groups[slot.date].push(slot);
            });
        return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    }, [mySlots]);

    const slotSummary = useMemo(() => {
        const available = mySlots.filter(slot => slot.status === 'available').length;
        const booked = mySlots.filter(slot => slot.status === 'booked').length;
        return { available, booked };
    }, [mySlots]);

    const formatSlotLabel = (slot: any) => {
        if (typeof slot === 'string') return slot;
        return slot.time;
    };

    const getSlotId = (slot: any) => {
        if (typeof slot === 'string') return '';
        return slot._id;
    };

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
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Manage Availability</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* ADD NEW SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Publish Slots</Text>

                    <View style={styles.modeTabs}>
                        <TouchableOpacity
                            style={[styles.modeTab, publishMode === 'single' && styles.activeModeTab]}
                            onPress={() => setPublishMode('single')}
                        >
                            <Text style={[styles.modeText, publishMode === 'single' && styles.activeModeText]}>Single Day</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeTab, publishMode === 'weekly' && styles.activeModeTab]}
                            onPress={() => setPublishMode('weekly')}
                        >
                            <Text style={[styles.modeText, publishMode === 'weekly' && styles.activeModeText]}>Weekly Repeat</Text>
                        </TouchableOpacity>
                    </View>

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

                    {publishMode === 'weekly' && (
                        <>
                            <Text style={styles.subLabel}>Repeat on:</Text>
                            <View style={styles.weekdayRow}>
                                {WEEKDAYS.map(day => (
                                    <TouchableOpacity
                                        key={day.value}
                                        style={[styles.weekdayBtn, selectedWeekdays.includes(day.value) && styles.activeWeekdayBtn]}
                                        onPress={() => toggleWeekday(day.value)}
                                    >
                                        <Text style={[styles.weekdayText, selectedWeekdays.includes(day.value) && styles.activeWeekdayText]}>{day.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.subLabel}>Publish ahead:</Text>
                            <View style={styles.weeksInputRow}>
                                <TextInput
                                    style={styles.weeksInput}
                                    value={weeks}
                                    onChangeText={setWeeks}
                                    keyboardType="numeric"
                                    placeholder="4"
                                    placeholderTextColor="#94A3B8"
                                />
                                <Text style={styles.weeksLabel}>weeks, max 12</Text>
                            </View>
                        </>
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
                                <Text style={styles.publishBtnText}>{publishMode === 'weekly' ? 'Publish Weekly Slots' : 'Publish Slots'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* EXISTING SLOTS SECTION */}
                <View style={[styles.section, { marginTop: 20 }]}>
                    <Text style={styles.sectionTitle}>Current Availability</Text>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryPill}>
                            <Text style={styles.summaryValue}>{slotSummary.available}</Text>
                            <Text style={styles.summaryLabel}>Available</Text>
                        </View>
                        <View style={styles.summaryPill}>
                            <Text style={styles.summaryValue}>{slotSummary.booked}</Text>
                            <Text style={styles.summaryLabel}>Booked</Text>
                        </View>
                    </View>
                    {groupedSlots.length === 0 ? (
                        <Text style={styles.emptyText}>No slots published yet.</Text>
                    ) : (
                        groupedSlots.map(([d, slots]) => (
                            <View key={d} style={styles.slotGroup}>
                                <Text style={styles.slotDate}>{new Date(d).toDateString()}</Text>
                                <View style={styles.badgeContainer}>
                                    {slots.map((slot: any, idx) => (
                                        <TouchableOpacity
                                            key={getSlotId(slot) || idx}
                                            style={styles.badge}
                                            onPress={() => getSlotId(slot) && cancelSlot(getSlotId(slot))}
                                        >
                                            <Text style={styles.badgeText}>{formatSlotLabel(slot)}</Text>
                                            <Ionicons name="close" size={12} color="#1A237E" />
                                        </TouchableOpacity>
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
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    scrollContent: { padding: 20 },
    section: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 3 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E', marginBottom: 15 },
    modeTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 16 },
    modeTab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    activeModeTab: { backgroundColor: '#1A237E' },
    modeText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
    activeModeText: { color: '#fff' },
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
    weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
    weekdayBtn: {
        width: '13%',
        minWidth: 38,
        marginRight: 5,
        marginBottom: 8,
        paddingVertical: 9,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    activeWeekdayBtn: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
    weekdayText: { color: '#1A237E', fontSize: 12, fontWeight: '700' },
    activeWeekdayText: { color: '#fff' },
    weeksInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
    weeksInput: {
        width: 70,
        height: 44,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        backgroundColor: '#F8FAFC',
    },
    weeksLabel: { marginLeft: 10, color: '#64748B', fontWeight: '600' },
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
    summaryRow: { flexDirection: 'row', marginBottom: 14 },
    summaryPill: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    summaryValue: { color: '#1A237E', fontSize: 20, fontWeight: '900' },
    summaryLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', marginTop: 2 },
    slotGroup: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingVertical: 12
    },
    slotDate: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
    badgeContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        marginRight: 6,
        marginBottom: 6,
        gap: 6,
    },
    badgeText: { fontSize: 12, color: '#1A237E', fontWeight: '600' },
    emptyText: { textAlign: 'center', color: '#64748B', marginTop: 10, fontStyle: 'italic' },
});
