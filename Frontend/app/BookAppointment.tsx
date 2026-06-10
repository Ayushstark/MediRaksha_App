import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    TextInput,
    Platform,
    Modal,
    ActivityIndicator,
    Image,
    FlatList,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import API from '../apiClient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInUp, ZoomIn, SlideInRight } from 'react-native-reanimated';
import { classifySymptom } from '../services/huggingFaceService';
import { bookAppointment, getAvailableSlots, getDoctors, toDateString } from '../services/medirakshaApi';

const SPECIALTIES = [
    { id: '1', name: 'General Physician', icon: 'stethoscope' },
    { id: '2', name: 'Cardiologist', icon: 'heartbeat' },
    { id: '3', name: 'Dermatology', icon: 'hand-holding-medical' },
    { id: '4', name: 'Orthopedics', icon: 'bone' },
    { id: '5', name: 'Pediatrics', icon: 'baby' },
    { id: '6', name: 'Neurologist', icon: 'brain' },
];

const normalizeSpeciality = (value: any) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || normalized === "general") return "General Physician";
    if (normalized === "general medicine") return "General Physician";
    return String(value).trim();
};

const DOCTORS_FALLBACK = [
    { id: 'd1', name: 'Dr. Sarah Wilson', specialty: 'General Physician', rating: 4.8, exp: '10 yrs', fee: '500' },
];

export default function BookAppointment() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // --- STEP STATE ---
    const [step, setStep] = useState(1);

    // --- DATA STATE ---
    const [allDoctors, setAllDoctors] = useState<any[]>([]);
    const [rawDoctorMap, setRawDoctorMap] = useState<Record<string, string[]>>({}); // id -> availability strings
    const [doctorList, setDoctorList] = useState<any[]>([]);
    const [slots, setSlots] = useState<any[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // --- FORM DATA ---
    const [selectedSpecialty, setSelectedSpecialty] = useState(params.specialty || '');
    const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
    const [consultType, setConsultType] = useState('In-Person');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<any>(null);
    const [reason, setReason] = useState('');
    const [patientInfo, setPatientInfo] = useState({ name: '', age: '', gender: 'Male', phone: '' });
    const [paymentMethod, setPaymentMethod] = useState('Clinic');

    // --- LOGIC STATES ---
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [aiMatching, setAiMatching] = useState(false);

    const { doctorId, doctorName, specialty: paramSpecialty, hospitalName: paramHospitalName } = params;

    // 1. Fetch Doctors on Mount
    useEffect(() => {
        const loadDoctors = async () => {
            try {
                const data = await getDoctors();
                const rawMap: Record<string, string[]> = {};
                const doctors = (Array.isArray(data) ? data : []).map((doc: any) => {
                    // Store the raw availability strings for client-side slot filtering
                    rawMap[doc.id] = Array.isArray(doc.availability) ? doc.availability : [];
                    return {
                        id: doc.id,
                        name: doc.name,
                        specialty: normalizeSpeciality(doc.specialization),
                        hospitalName: doc.hospital || "MediRaksha Clinic",
                        rating: doc.rating || (4.5 + (Math.random() * 0.5)),
                        exp: doc.experience || '10+ yrs',
                        fee: doc.fee || '500'
                    };
                });
                setRawDoctorMap(rawMap);
                setAllDoctors(doctors);
                setDoctorList(doctors);
            } catch (error) {
                console.error("Failed to load doctors:", error);
                setAllDoctors(DOCTORS_FALLBACK);
            }
        };
        loadDoctors();
    }, []);

    // 2. Filter Doctors by Specialty
    useEffect(() => {
        const specialtyStr = Array.isArray(selectedSpecialty) ? selectedSpecialty[0] : selectedSpecialty;
        if (!specialtyStr || specialtyStr === 'All') {
            setDoctorList(allDoctors);
        } else {
            const filtered = allDoctors.filter(d =>
                d.specialty.toLowerCase() === specialtyStr.toLowerCase()
            );
            setDoctorList(filtered);
        }
    }, [selectedSpecialty, allDoctors]);

    // 3. Handle External Param (from DoctorDetails)
    useEffect(() => {
        if ((doctorId || doctorName) && step === 1) {
            const found = allDoctors.find(d =>
                (doctorId && d.id === doctorId) || (doctorName && d.name === doctorName)
            );
            if (found) {
                setSelectedDoctor(found);
                setSelectedSpecialty(found.specialty);
                setStep(3);
            }
        }
    }, [doctorId, doctorName, allDoctors, step]);

    // 4. Load Slots when Doctor/Date changes
    useEffect(() => {
        if (selectedDoctor && selectedDate && step === 4) {
            setSlots([]); // Clear slots on date change
            setSelectedTimeSlot(null);
        }
    }, [selectedDoctor, selectedDate, step]);

    const loadSlots = async () => {
        if (!selectedDoctor) return;
        setLoadingSlots(true);
        setSelectedTimeSlot(null);
        setSlots([]);

        const dateStr = toDateString(selectedDate);

        console.log(`[BookAppointment] Loading slots for doctor ${selectedDoctor.id} on ${dateStr}`);

        try {
            const responseData: any = await getAvailableSlots(selectedDoctor.id, dateStr);

            // Guard: if the server returned HTML instead of JSON (route missing on Render),
            // fall back to client-side filtering from the cached availability strings.
            if (typeof responseData === 'string' && responseData.trim().startsWith('<')) {
                console.warn('[BookAppointment] API returned HTML — falling back to client-side slot filtering');
                clientSideFilter(dateStr);
                return;
            }

            if (Array.isArray(responseData) && responseData.length > 0) {
                setSlots(responseData);
                console.log(`[BookAppointment] Loaded ${responseData.length} slot(s) from API`);
            } else {
                // API worked but returned empty — also try client-side filtering as backup
                clientSideFilter(dateStr);
            }
        } catch (err: any) {
            console.warn('[BookAppointment] API call failed, using client-side filter. Error:', err?.response?.status);
            clientSideFilter(dateStr);
        } finally {
            setLoadingSlots(false);
        }
    };

    /**
     * Filters the cached availability strings for the selected doctor and date.
     * Availability strings look like: "2026-03-18 | 09:00 - 09:15"
     * Produces fake slot objects compatible with the rest of the UI.
     */
    const clientSideFilter = (dateStr: string) => {
        const availability = rawDoctorMap[selectedDoctor?.id] || [];
        const prefix = `${dateStr} | `;
        const filtered = availability
            .filter((entry: string) => entry.startsWith(prefix))
            .map((entry: string, idx: number) => ({
                _id: `local-${dateStr}-${idx}`,  // local fallback ID, not a persisted PostgreSQL slot ID
                time: entry.replace(prefix, '').trim(),
                status: 'available',
                isLocalSlot: true,
            }));

        setSlots(filtered);
        console.log(`[BookAppointment] Client-side filter found ${filtered.length} slot(s) for ${dateStr}`);
    };

    // --- HANDLERS ---
    const handleNextStep = () => setStep(step + 1);
    const handlePrevStep = () => setStep(step - 1);

    const handleAiMatch = async () => {
        if (!reason.trim()) {
            Alert.alert('AI Missing Context', 'Please describe your symptoms for AI matching.');
            return;
        }
        setAiMatching(true);
        try {
            const specialtyNames = SPECIALTIES.map(s => s.name);
            const result = await classifySymptom(reason, specialtyNames);
            if (result.label) {
                setSelectedSpecialty(result.label);
                Alert.alert("AI Match", `Suggested: ${result.label}`);
                setStep(2);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("AI Error", "Matching failed.");
        } finally {
            setAiMatching(false);
        }
    };

    const handleBooking = async () => {
        if (!selectedTimeSlot) {
            Alert.alert('Selection Required', 'Please pick a time slot first.');
            return;
        }
        if (!patientInfo.name.trim()) {
            Alert.alert('Required', 'Please enter your name before confirming.');
            return;
        }

        const dateStr = toDateString(selectedDate);

        setLoading(true);
        try {
            if (selectedTimeSlot.isLocalSlot) {
                throw new Error('Please select a server-published slot.');
            }

            const response = await bookAppointment({
                doctorId: selectedDoctor?.id,
                slotId: selectedTimeSlot.id || selectedTimeSlot._id,
                appointmentDate: dateStr,
                reasonOfAppointment: reason || 'Mobile App Booking',
            });
            if (!response?.appointmentId) {
                throw new Error('Appointment confirmation was not returned by the server.');
            }
            console.log('[BookAppointment] Booking API success');
            setShowSuccess(true);
        } catch (error: any) {
            console.error('Booking Logic Error:', error);
            Alert.alert('Booking Failed', error.response?.data?.detail || error.message || 'Could not confirm this appointment.');
        } finally {
            setLoading(false);
        }
    };


    // --- UI COMPONENTS FOR EACH STEP ---
    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={step === 1 ? () => router.back() : handlePrevStep}>
                <Ionicons name="arrow-back" size={24} color="#1A237E" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Book Appointment</Text>
                <Text style={styles.stepIndicator}>Step {step} of 5</Text>
            </View>
            <View style={{ width: 24 }} />
        </View>
    );

    const renderStep1 = () => (
        <Animated.View entering={FadeInUp} style={styles.stepContainer}>
            <View style={styles.discoveryHeader}>
                <Text style={styles.label}>Smart Discovery</Text>
                <Text style={styles.subLabelHint}>How are you feeling today?</Text>
            </View>

            <View style={styles.aiSearchBox}>
                <TextInput
                    style={styles.aiInputEnhanced}
                    placeholder="Describe symptoms (e.g., 'Sharp back pain')..."
                    multiline
                    value={reason}
                    onChangeText={setReason}
                />
                <TouchableOpacity style={styles.aiMatchBtnEnhanced} onPress={handleAiMatch} disabled={aiMatching}>
                    {aiMatching ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <FontAwesome5 name="robot" size={18} color="#fff" />
                            <Text style={styles.aiMatchText}>AI Match</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.aiDivider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>OR BROWSE SPECIALTIES</Text>
                <View style={styles.line} />
            </View>

            <View style={styles.specialtyGrid}>
                {SPECIALTIES.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.specialtyCard, selectedSpecialty === item.name && styles.activeCard]}
                        onPress={() => {
                            setSelectedSpecialty(item.name);
                            handleNextStep(); // Auto-advance for specialties
                        }}
                    >
                        <FontAwesome5 name={item.icon} size={24} color={selectedSpecialty === item.name ? '#fff' : '#1A237E'} />
                        <Text style={[styles.specialtyText, selectedSpecialty === item.name && styles.activeText]}>{item.name}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={styles.nearMeBtn}
                onPress={() => router.push({ pathname: '/NearbyHospitals', params: { automated: 'true' } })}
            >
                <Ionicons name="location" size={18} color="#1A237E" />
                <Text style={styles.nearMeText}>Find Hospitals Around Me</Text>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderStep2 = () => (
        <Animated.View entering={SlideInRight} style={styles.stepContainer}>
            <View style={{ gap: 15 }}>
                {doctorList.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={60} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No Doctors Available</Text>
                        <Text style={styles.emptySub}>No doctors have published slots for this specialty yet. Please try another one. </Text>
                    </View>
                ) : (
                    doctorList.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.doctorCard, selectedDoctor?.id === item.id && styles.activeCard]}
                            onPress={() => setSelectedDoctor(item)}
                        >
                            <View style={styles.drRow}>
                                <View style={styles.drAvatar}>
                                    <FontAwesome5 name="user-md" size={30} color={selectedDoctor?.id === item.id ? '#fff' : '#1A237E'} />
                                </View>
                                <View style={styles.drInfo}>
                                    <Text style={[styles.drName, selectedDoctor?.id === item.id && styles.activeText]}>{item.name}</Text>
                                    <Text style={[styles.drSub, selectedDoctor?.id === item.id && styles.activeText]}>{item.specialty} • {item.exp}</Text>
                                    <View style={styles.ratingRow}>
                                        <Ionicons name="star" size={14} color="#FFD700" />
                                        <Text style={[styles.ratingText, selectedDoctor?.id === item.id && styles.activeText]}>{item.rating}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.feeText, selectedDoctor?.id === item.id && styles.activeText]}>₹{item.fee}</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>
            {selectedDoctor && (
                <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                    <Text style={styles.nextBtnText}>Confirm Doctor</Text>
                </TouchableOpacity>
            )}
        </Animated.View>
    );

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.label}>3. Appointment Type</Text>
            <View style={styles.typeRow}>
                {['In-Person', 'Tele-Consult'].map(t => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.typeBtn, consultType === t && styles.activeType]}
                        onPress={() => setConsultType(t)}
                    >
                        <Ionicons name={t === 'In-Person' ? 'business' : 'videocam'} size={24} color={consultType === t ? '#fff' : '#1A237E'} />
                        <Text style={[styles.typeText, consultType === t && styles.activeText]}>{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                <Text style={styles.nextBtnText}>Select Slot</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.label}>4. Pick Date & Time</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar" size={20} color="#1A237E" />
                <Text style={styles.dateText}>{selectedDate.toDateString()}</Text>
            </TouchableOpacity>
            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(e, d) => { setShowDatePicker(false); if (d) setSelectedDate(d); }}
                />
            )}

            <TouchableOpacity 
                style={[styles.nextBtn, { marginTop: 10, marginBottom: 20, backgroundColor: (!selectedDoctor || !selectedDate) ? '#CBD5E1' : '#4CAF50' }]} 
                onPress={loadSlots}
                disabled={!selectedDoctor || !selectedDate || loadingSlots}
            >
                {loadingSlots ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Show Available Slots</Text>}
            </TouchableOpacity>

            <Text style={styles.subLabel}>Available Slots</Text>
            <View style={styles.slotGrid}>
                {loadingSlots ? null : (
                    slots.length === 0 ? <Text style={styles.subtext}>No slots available for this date.</Text> : (
                        slots.map((s: any) => (
                            <TouchableOpacity
                                key={s._id}
                                disabled={s.status !== 'available'}
                                style={[
                                    styles.slotBtn,
                                    selectedTimeSlot?._id === s._id && styles.activeSlot,
                                    s.status !== 'available' && { backgroundColor: '#f0f0f0', opacity: 0.5 }
                                ]}
                                onPress={() => setSelectedTimeSlot(s)}
                            >
                                <Text style={[
                                    styles.slotText,
                                    selectedTimeSlot?._id === s._id && styles.activeText,
                                    s.status !== 'available' && { color: '#999' }
                                ]}>{s.time}</Text>
                            </TouchableOpacity>
                        ))
                    )
                )}
            </View>
            {selectedTimeSlot && (
                <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                    <Text style={styles.nextBtnText}>Enter Patient Details</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderStep5 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.label}>5. Patient Details</Text>
            <TextInput
                style={styles.input}
                placeholder="Patient Full Name"
                value={patientInfo.name}
                onChangeText={(v) => setPatientInfo({ ...patientInfo, name: v })}
            />
            <TextInput
                style={styles.input}
                placeholder="Phone Number"
                keyboardType="phone-pad"
                value={patientInfo.phone}
                onChangeText={(v) => setPatientInfo({ ...patientInfo, phone: v })}
            />
            <TextInput
                style={styles.input}
                placeholder="Age"
                keyboardType="numeric"
                value={patientInfo.age}
                onChangeText={(v) => setPatientInfo({ ...patientInfo, age: v })}
            />
            
            <View style={styles.genderRowContainer}>
                <Text style={styles.genderLabel}>Gender</Text>
                <View style={styles.genderRow}>
                    {['Male', 'Female', 'Other'].map(g => (
                        <TouchableOpacity
                            key={g}
                            style={[styles.genderBtn, patientInfo.gender === g && styles.activeGender]}
                            onPress={() => setPatientInfo({ ...patientInfo, gender: g })}
                        >
                            <Text style={[styles.genderText, patientInfo.gender === g && styles.activeText]}>{g}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleBooking} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm Appointment</Text>}
            </TouchableOpacity>
        </View>
    );

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined} 
            style={styles.container}
        >
            {renderHeader()}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
            </ScrollView>

            {/* SUCCESS MODAL */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View entering={ZoomIn} style={styles.successBox}>
                        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                        <Text style={styles.successTitle}>Booking Verified!</Text>
                        <Text style={styles.successMsg}>
                            Confirmed Dr. {selectedDoctor?.name}{'\n'}
                            on {selectedDate.toDateString()} at {selectedTimeSlot?.time}
                        </Text>
                        <View style={styles.qrPlaceholder}>
                            <Ionicons name="qr-code" size={100} color="#333" />
                            <Text style={styles.qrText}>Booking ID: MED-{Math.floor(Math.random() * 90000) + 10000}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => router.replace('/PatientDashboard')}>
                            <Text style={styles.closeBtnText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    stepIndicator: { fontSize: 12, color: '#64748B' },
    scrollContent: { padding: 20 },
    stepContainer: { flex: 1 },
    label: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
    specialtyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    specialtyCard: {
        width: '48%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 15,
        elevation: 4,
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    specialtyText: { marginTop: 12, fontSize: 14, fontWeight: '700', color: '#1E293B' },
    activeCard: { backgroundColor: '#1A237E' },
    activeText: { color: '#fff' },
    aiDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
    dividerText: { marginHorizontal: 10, fontSize: 10, color: '#64748B', fontWeight: 'bold' },
    aiInput: { backgroundColor: '#fff', borderRadius: 12, padding: 15, height: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0' },
    aiMatchBtn: { flexDirection: 'row', backgroundColor: '#4CAF50', padding: 15, borderRadius: 12, marginTop: 15, alignItems: 'center', justifyContent: 'center' },
    aiMatchText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    nextBtn: { backgroundColor: '#4CAF50', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 30 },
    nextBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    doctorCard: {
        backgroundColor: '#fff',
        padding: 18,
        borderRadius: 20,
        marginBottom: 15,
        elevation: 4,
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    drRow: { flexDirection: 'row', alignItems: 'center' },
    drAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    drInfo: { flex: 1, marginLeft: 15 },
    drName: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    drSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    ratingText: { marginLeft: 6, fontSize: 13, fontWeight: '700', color: '#1E293B' },
    feeText: { fontSize: 18, fontWeight: '800', color: '#4F46E5' },
    typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    typeBtn: { width: '48%', backgroundColor: '#fff', padding: 20, borderRadius: 15, alignItems: 'center', elevation: 2 },
    typeText: { marginTop: 10, fontWeight: 'bold' },
    activeType: { backgroundColor: '#1A237E' },
    datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20 },
    dateText: { marginLeft: 10, fontSize: 16 },
    subLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#1A237E' },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    slotBtn: { width: '31%', backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10, elevation: 1 },
    activeSlot: { backgroundColor: '#1A237E' },
    slotText: { color: '#1A237E', fontWeight: '500' },
    input: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    genderRowContainer: { marginBottom: 20 },
    genderLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
    genderRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
    genderBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    genderText: { color: '#64748B', fontWeight: '700' },
    activeGender: { backgroundColor: '#1A237E' },
    activeGenderText: { color: '#fff' },
    billBox: { backgroundColor: '#fff', padding: 20, borderRadius: 15 },
    billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    totalRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, borderTopColor: '#E2E8F0' },
    totalLabel: { fontWeight: 'bold', fontSize: 18 },
    totalValue: { fontWeight: 'bold', fontSize: 18, color: '#1A237E' },
    payOptionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    payBtn: { width: '30%', backgroundColor: '#fff', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
    payText: { color: '#1A237E', fontWeight: '500' },
    activePay: { backgroundColor: '#1A237E' },
    confirmBtn: {
        backgroundColor: '#4F46E5',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 30,
        elevation: 8,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
    },
    confirmBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 30 },
    successBox: { backgroundColor: '#fff', padding: 30, borderRadius: 30, alignItems: 'center', width: '100%', elevation: 10 },
    successTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A237E', marginVertical: 15 },
    successMsg: { textAlign: 'center', color: '#64748B', lineHeight: 22 },
    subtext: { fontSize: 13, color: '#64748B', marginTop: 4 },
    qrPlaceholder: { marginVertical: 25, alignItems: 'center' },
    qrText: { marginTop: 10, fontSize: 12, color: '#1A237E', fontWeight: 'bold' },
    closeBtn: { backgroundColor: '#1A237E', paddingVertical: 15, width: '100%', borderRadius: 15, alignItems: 'center' },
    closeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    discoveryHeader: { marginBottom: 20 },
    subLabelHint: { fontSize: 14, color: '#64748B', marginTop: 4 },
    aiSearchBox: { backgroundColor: '#fff', borderRadius: 15, padding: 15, elevation: 3, borderLeftWidth: 5, borderLeftColor: '#4CAF50' },
    aiInputEnhanced: { fontSize: 16, color: '#333', marginBottom: 15, height: 60, textAlignVertical: 'top' },
    aiMatchBtnEnhanced: { backgroundColor: '#1A237E', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    nearMeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 25, padding: 15, borderRadius: 12, backgroundColor: '#E0E7FF' },
    nearMeText: { marginLeft: 10, color: '#1A237E', fontWeight: 'bold' },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        marginTop: 50,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginTop: 15,
    },
    emptySub: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 20,
    },
});
