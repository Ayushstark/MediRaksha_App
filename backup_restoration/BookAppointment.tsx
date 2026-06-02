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
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import API from '../apiClient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInUp, ZoomIn, SlideInRight } from 'react-native-reanimated';
import { classifySymptom } from '../services/huggingFaceService';

const SPECIALTIES = [
    { id: '1', name: 'General', icon: 'stethoscope' },
    { id: '2', name: 'Cardiology', icon: 'heartbeat' },
    { id: '3', name: 'Dermatology', icon: 'hand-holding-medical' },
    { id: '4', name: 'Orthopedics', icon: 'bone' },
    { id: '5', name: 'Pediatrics', icon: 'baby' },
    { id: '6', name: 'Neurology', icon: 'brain' },
];

const DOCTORS_FALLBACK = [
    { id: 'd1', name: 'Dr. Sarah Wilson', specialty: 'General', rating: 4.8, exp: '10 yrs', fee: '500' },
];

export default function BookAppointment() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // --- STEP STATE ---
    const [step, setStep] = useState(1);

    // --- DATA STATE ---
    const [allDoctors, setAllDoctors] = useState<any[]>([]);
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

    const { doctorName, specialty: paramSpecialty, hospitalName: paramHospitalName } = params;

    // 1. Fetch Doctors on Mount
    useEffect(() => {
        const loadDoctors = async () => {
            try {
                const { data } = await API.get('/slots/doctors');
                const doctors = (Array.isArray(data) ? data : []).map((doc) => ({
                    id: doc._id,
                    name: doc.name,
                    specialty: doc.specialization || 'General',
                    hospitalName: doc.hospital || "MediRaksha Clinic",
                    rating: 4.5 + (Math.random() * 0.5), // Randomized for UI polish
                    exp: '10+ yrs',
                    fee: '500'
                }));
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
        if (!specialtyStr) {
            setDoctorList(allDoctors);
        } else {
            const filtered = allDoctors.filter(d =>
                d.specialty.toLowerCase().includes(specialtyStr.toLowerCase()) ||
                specialtyStr === 'General'
            );
            setDoctorList(filtered);
        }
    }, [selectedSpecialty, allDoctors]);

    // 3. Handle External Param (from DoctorDetails)
    useEffect(() => {
        if (doctorName && step === 1) {
            const found = allDoctors.find(d => d.name === doctorName);
            if (found) {
                setSelectedDoctor(found);
                setSelectedSpecialty(found.specialty);
                setStep(3);
            }
        }
    }, [doctorName, allDoctors, step]);

    // 4. Load Slots when Doctor/Date changes
    useEffect(() => {
        if (selectedDoctor && selectedDate && step === 4) {
            loadSlots();
        }
    }, [selectedDoctor, selectedDate, step]);

    const loadSlots = async () => {
        setLoadingSlots(true);
        setSelectedTimeSlot(null);
        try {
            // Use local date to avoid timezone shift from toISOString()
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const { data } = await API.get(`/slots/${selectedDoctor.id}/${dateStr}`);
            setSlots(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load slots:', err);
            setSlots([]);
        } finally {
            setLoadingSlots(false);
        }
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

        setLoading(true);
        try {
            // MATCHING WEBSITE SCHEMA: { slotId, patient: { name, phone, age, notes } }
            const response = await API.post('/slots/book', {
                slotId: selectedTimeSlot._id,
                patient: {
                    name: patientInfo.name,
                    phone: patientInfo.phone || '9999999999',
                    age: patientInfo.age,
                    notes: reason || 'Mobile App Booking'
                }
            });

            if (response.data) {
                setShowSuccess(true);
            }
        } catch (error: any) {
            console.error('Booking Error:', error.response?.data);
            Alert.alert('Booking Failed', error.response?.data?.message || 'Server rejected the booking.');
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
                <Text style={styles.stepIndicator}>Step {step} of 6</Text>
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
                {doctorList.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.doctorCard, selectedDoctor?.id === item.id && styles.activeCard]}
                        onPress={() => setSelectedDoctor(item)}
                    >
                        <View style={styles.drRow}>
                            <View style={styles.drAvatar}>
                                <FontAwesome5 name="user-md" size={30} color={selectedDoctor?.id === item.id ? '#1A237E' : '#fff'} />
                            </View>
                            <View style={styles.drInfo}>
                                <Text style={[styles.drName, selectedDoctor?.id === item.id && styles.activeText]}>{item.name}</Text>
                                <Text style={styles.drSub}>{item.specialty} • {item.exp}</Text>
                                <View style={styles.ratingRow}>
                                    <Ionicons name="star" size={14} color="#FFD700" />
                                    <Text style={styles.ratingText}>{item.rating}</Text>
                                </View>
                            </View>
                            <Text style={styles.feeText}>₹{item.fee}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
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
                    onChange={(e, d) => { setShowDatePicker(false); if (d) setSelectedDate(d); }}
                />
            )}
            <Text style={styles.subLabel}>Available Slots</Text>
            <View style={styles.slotGrid}>
                {loadingSlots ? <ActivityIndicator color="#1A237E" /> : (
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
            <View style={styles.infoRow}>
                <TextInput
                    style={[styles.input, { flex: 1, marginRight: 10 }]}
                    placeholder="Age"
                    keyboardType="numeric"
                    value={patientInfo.age}
                    onChangeText={(v) => setPatientInfo({ ...patientInfo, age: v })}
                />
                <View style={styles.genderRow}>
                    {['Male', 'Female'].map(g => (
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
            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                <Text style={styles.nextBtnText}>Go to Payment</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep6 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.label}>6. Payment & Confirmation</Text>
            <View style={styles.billBox}>
                <View style={styles.billRow}><Text>Consultation Fee</Text><Text>₹{selectedDoctor?.fee || '0'}</Text></View>
                <View style={styles.billRow}><Text>Platform Charges</Text><Text>₹50</Text></View>
                <View style={[styles.billRow, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>₹{parseInt(selectedDoctor?.fee || '0') + 50}</Text></View>
            </View>
            <Text style={styles.subLabel}>Choose Method</Text>
            <View style={styles.payOptionRow}>
                {['UPI', 'Card', 'Clinic'].map(m => (
                    <TouchableOpacity
                        key={m}
                        style={[styles.payBtn, paymentMethod === m && styles.activePay]}
                        onPress={() => setPaymentMethod(m)}
                    >
                        <Text style={[styles.payText, paymentMethod === m && styles.activeText]}>{m}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleBooking} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Pay & Confirm Appointment</Text>}
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
                {step === 6 && renderStep6()}
            </ScrollView>

            {/* SUCCESS MODAL */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View entering={ZoomIn} style={styles.successBox}>
                        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                        <Text style={styles.successTitle}>Booking Verified!</Text>
                        <Text style={styles.successMsg}>
                            Confirmed Dr. {selectedDoctor?.name}{'\n'}
                            on {selectedDate.toDateString()} at {selectedTimeSlot}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#fff' },
    headerTitleContainer: { flex: 1, marginLeft: 15 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A237E' },
    stepIndicator: { fontSize: 12, color: '#64748B' },
    scrollContent: { padding: 20 },
    stepContainer: { flex: 1 },
    label: { fontSize: 20, fontWeight: 'bold', color: '#1A237E', marginBottom: 20 },
    specialtyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    specialtyCard: { width: '48%', backgroundColor: '#fff', padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 15, elevation: 2 },
    specialtyText: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#1A237E' },
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
    doctorCard: { backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2 },
    drRow: { flexDirection: 'row', alignItems: 'center' },
    drAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1A237E', justifyContent: 'center', alignItems: 'center' },
    drInfo: { flex: 1, marginLeft: 15 },
    drName: { fontSize: 16, fontWeight: 'bold', color: '#1A237E' },
    drSub: { fontSize: 12, color: '#64748B' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    ratingText: { marginLeft: 5, fontSize: 12, fontWeight: 'bold' },
    feeText: { fontSize: 16, fontWeight: 'bold', color: '#4CAF50' },
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
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    genderRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 5, flex: 1 },
    genderBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
    genderText: { color: '#1A237E', fontWeight: '500' },
    activeGender: { backgroundColor: '#1A237E' },
    billBox: { backgroundColor: '#fff', padding: 20, borderRadius: 15 },
    billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    totalRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, borderTopColor: '#E2E8F0' },
    totalLabel: { fontWeight: 'bold', fontSize: 18 },
    totalValue: { fontWeight: 'bold', fontSize: 18, color: '#1A237E' },
    payOptionRow: { flexDirection: 'row', justifyContent: 'space-between' },
    payBtn: { width: '30%', backgroundColor: '#fff', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
    payText: { color: '#1A237E', fontWeight: '500' },
    activePay: { backgroundColor: '#1A237E' },
    confirmBtn: { backgroundColor: '#1A237E', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 30 },
    confirmBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
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
});
