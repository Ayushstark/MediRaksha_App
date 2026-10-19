import React, { useState, useEffect, useMemo } from 'react';
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
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInUp, ZoomIn, SlideInRight } from 'react-native-reanimated';
import { classifySymptom } from '../services/huggingFaceService';
import API from '../apiClient';
import {
    bookAppointment,
    getAvailableSlots,
    getDoctors,
    getPatientAppointments,
    normalizeSpeciality,
    toDateString,
    isSlotPassed,
    filterUpcomingSlots,
    formatTime12Hour,
    formatSlotDateBadge,
    formatSlotDateFull,
} from '../services/medirakshaApi';
import { scheduleAppointmentReminder } from '../services/appointmentReminders';
import { colors } from '../constants/theme';

const SPECIALTIES = [
    { id: '1', name: 'General Physician', icon: 'stethoscope' },
    { id: '2', name: 'Cardiologist', icon: 'heartbeat' },
    { id: '3', name: 'Dermatology', icon: 'hand-holding-medical' },
    { id: '4', name: 'Orthopedics', icon: 'bone' },
    { id: '5', name: 'Pediatrics', icon: 'baby' },
    { id: '6', name: 'Neurologist', icon: 'brain' },
];

const DOCTORS_FALLBACK = [
    { id: 'd1', name: 'Dr. Sarah Wilson', specialty: 'General Physician', rating: 4.8, exp: '10 yrs', fee: '500' },
];

export default function BookAppointment() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { doctorId, doctorName } = params;
    const hasDirectDoctor = Boolean(doctorId || doctorName);
    const passedAvailability = useMemo(() => {
        try {
            const raw = Array.isArray(params.availability) ? params.availability[0] : params.availability;
            const parsed = raw ? JSON.parse(String(raw)) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, [params.availability]);

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
    const [doctorSearchQuery, setDoctorSearchQuery] = useState('');
    const [consultType, setConsultType] = useState('In-Person');
    const [selectedDate, setSelectedDate] = useState(() => {
        if (params.initialDate) {
            const initD = new Date(`${params.initialDate}T00:00:00`);
            if (!isNaN(initD.getTime())) return initD;
        }
        return new Date();
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<any>(null);
    const [reason, setReason] = useState('');
    const [patientInfo, setPatientInfo] = useState({ name: '', age: '', gender: 'Male', phone: '' });
    const [selectedReport, setSelectedReport] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

    // --- LOGIC STATES ---
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [aiMatching, setAiMatching] = useState(false);

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
                        specialty: normalizeSpeciality(doc.speciality ?? doc.specialization ?? doc.specialty),
                        hospitalName: doc.hospital || "MediRaksha Clinic",
                        address: doc.address || '',
                        distance: doc.distance,
                        rating: doc.rating || (4.5 + (Math.random() * 0.5)),
                        exp: doc.experience ? `${doc.experience} yrs` : '10+ yrs',
                        fee: doc.fee || '500',
                        availableSlots: Array.isArray(doc.availableSlots) ? doc.availableSlots : [],
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
            const normalizedSpecialty = normalizeSpeciality(specialtyStr);
            const filtered = allDoctors.filter(d =>
                normalizeSpeciality(d.specialty).toLowerCase() === normalizedSpecialty.toLowerCase()
            );
            setDoctorList(filtered);
        }
    }, [selectedSpecialty, allDoctors]);

    const filteredDoctorList = useMemo(() => {
        let list = doctorList;
        if (doctorSearchQuery.trim()) {
            const q = doctorSearchQuery.trim().toLowerCase();
            const tokens = q.split(/\s+/).filter(Boolean);
            list = list.filter((doc) => {
                const haystack = `${doc.name} ${doc.specialty} ${doc.hospitalName || ''} ${doc.address || ''}`.toLowerCase();
                return tokens.every((token) => haystack.includes(token));
            });
        }
        return list;
    }, [doctorList, doctorSearchQuery]);

    // 3. Handle External Param (from DoctorDetails or DoctorList)
    useEffect(() => {
        if (params.initialDate) {
            try {
                const initD = new Date(`${params.initialDate}T00:00:00`);
                if (!isNaN(initD.getTime())) {
                    setSelectedDate(initD);
                }
            } catch {}
        }
        if (doctorId || doctorName) {
            const found = allDoctors.find(d =>
                (doctorId && String(d.id) === String(doctorId)) ||
                (doctorName && String(d.name).toLowerCase() === String(doctorName).toLowerCase())
            );
            if (found) {
                setSelectedDoctor({
                    ...found,
                    availableSlots: found.availableSlots?.length ? found.availableSlots : passedAvailability,
                });
                setSelectedSpecialty(found.specialty);
            } else if (doctorId || doctorName) {
                setSelectedDoctor({
                    id: String(doctorId || ''),
                    name: String(doctorName || 'Selected Doctor'),
                    specialty: '',
                    hospitalName: 'MediRaksha Clinic',
                    availableSlots: passedAvailability,
                });
                if (passedAvailability.length) {
                    setSlots(passedAvailability);
                }
            }
        }
    }, [doctorId, doctorName, allDoctors, passedAvailability, params.initialDate]);

    // Extract unique available dates from published slots
    const doctorAvailableDates = useMemo(() => {
        const slotsToScan = (selectedDoctor?.availableSlots?.length ? selectedDoctor.availableSlots : passedAvailability) || [];
        const dateSet = new Set<string>();
        const todayStr = toDateString(new Date());

        slotsToScan.forEach((slot: any) => {
            const d = slot.bookingDate || slot.date;
            if (d && d >= todayStr && slot.status !== 'booked') {
                if (!isSlotPassed(d, slot.slotTime || slot.time)) {
                    dateSet.add(d);
                }
            }
        });

        return Array.from(dateSet).sort();
    }, [selectedDoctor, passedAvailability]);

    // Auto-advance date to first date with available slots if today has none
    useEffect(() => {
        if (doctorAvailableDates.length > 0 && !params.initialDate) {
            const todayStr = toDateString(new Date());
            const hasSlotsToday = doctorAvailableDates.includes(todayStr);
            if (!hasSlotsToday) {
                setSelectedDate(new Date(`${doctorAvailableDates[0]}T00:00:00`));
            }
        }
    }, [doctorAvailableDates, params.initialDate]);

    // 4. Load Slots when Doctor or Date changes in step 2
    useEffect(() => {
        if (selectedDoctor && selectedDate && step === 2) {
            loadSlots();
        }
    }, [selectedDoctor?.id, toDateString(selectedDate), step]);

    // Auto-select initial slot when slots become available
    useEffect(() => {
        if (slots.length > 0 && !selectedTimeSlot) {
            const targetId = params.initialSlotId as string | undefined;
            const targetTime = params.initialSlotTime as string | undefined;
            if (targetId) {
                const match = slots.find((s: any) => String(s.id || s._id) === String(targetId));
                if (match) setSelectedTimeSlot(match);
            } else if (targetTime) {
                const match = slots.find((s: any) => (s.slotTime || s.time) === targetTime);
                if (match) setSelectedTimeSlot(match);
            }
        }
    }, [slots, params.initialSlotId, params.initialSlotTime, selectedTimeSlot]);

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
        if (!availability.length && passedAvailability.length) {
            const filteredPassedSlots = passedAvailability
                .filter((slot: any) => (slot.bookingDate || slot.date) === dateStr)
                .map((slot: any) => ({
                    ...slot,
                    _id: String(slot.id || slot._id),
                    id: String(slot.id || slot._id),
                    time: slot.time || slot.slotTime,
                    slotTime: slot.slotTime || slot.time,
                    bookingDate: slot.bookingDate || slot.date,
                    date: slot.date || slot.bookingDate,
                }));
            setSlots(filteredPassedSlots);
            console.log(`[BookAppointment] Passed availability found ${filteredPassedSlots.length} slot(s) for ${dateStr}`);
            return;
        }

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
    const handleNextStep = () => setStep(prev => Math.min(prev + 1, 3));
    const handlePrevStep = () => {
        if (step <= 1) {
            router.back();
            return;
        }
        setStep(prev => Math.max(prev - 1, 1));
    };

    const pickRecentReport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]) return;
            setSelectedReport(result.assets[0]);
        } catch (error) {
            console.error('Report picker error:', error);
            Alert.alert('Upload Error', 'Could not select the report file.');
        }
    };

    const uploadSelectedReport = async () => {
        if (!selectedReport || !selectedDoctor?.id) return;

        const formData = new FormData();
        formData.append('file', {
            uri: Platform.OS === 'ios' ? selectedReport.uri.replace('file://', '') : selectedReport.uri,
            name: selectedReport.name || `report_${Date.now()}.pdf`,
            type: selectedReport.mimeType || 'application/pdf',
        } as any);
        formData.append('title', selectedReport.name?.replace(/\.[^/.]+$/, '') || 'Recent Medical Report');
        formData.append('category', 'other');
        formData.append('visibility', 'doctor');
        formData.append('doctorId', String(selectedDoctor.id));
        formData.append('uploadedBy', 'user');

        await API.post('/user/report/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    };

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
        if (!reason.trim()) {
            Alert.alert('Required', 'Please enter the reason for your visit.');
            return;
        }

        const dateStr = selectedTimeSlot.bookingDate || selectedTimeSlot.date || toDateString(selectedDate);
        const slotTime = selectedTimeSlot.slotTime || selectedTimeSlot.time;

        if (isSlotPassed(dateStr, slotTime)) {
            setSlots(prev => prev.filter((s: any) => (s.id || s._id) !== (selectedTimeSlot.id || selectedTimeSlot._id)));
            setSelectedTimeSlot(null);
            Alert.alert(
                'Time Slot Passed',
                'This time slot has already passed and can no longer be booked. Please select an upcoming time slot.'
            );
            return;
        }

        setLoading(true);
        try {
            if (selectedTimeSlot.isLocalSlot) {
                throw new Error('Please select a server-published slot.');
            }

            const slotId = String(selectedTimeSlot.id || selectedTimeSlot._id || '');
            const latestSlots = await getAvailableSlots(String(selectedDoctor?.id), dateStr).catch((error: any) => {
                console.warn('[BookAppointment] Could not refresh slots before booking:', error?.response?.status || error?.message);
                return slots;
            });
            const stillAvailable = latestSlots.find((slot: any) =>
                String(slot.id || slot._id) === slotId && slot.status !== 'booked'
            );

            if (!stillAvailable) {
                setSlots(latestSlots);
                setSelectedTimeSlot(null);
                Alert.alert(
                    'Slot No Longer Available',
                    'This slot was already booked or removed. Please pick another available time.'
                );
                return;
            }

            const existingAppointments = await getPatientAppointments().catch((error: any) => {
                console.warn('[BookAppointment] Could not check existing appointments:', error?.response?.status || error?.message);
                return [];
            });
            const duplicateAppointment = existingAppointments.find((appointment: any) =>
                String(appointment.doctorId ?? appointment.doctor?.id ?? appointment.doctor?._id ?? '') === String(selectedDoctor?.id) &&
                String(appointment.appointmentDate || appointment.date || '').slice(0, 10) === dateStr &&
                !['cancelled', 'completed'].includes(String(appointment.status || '').toLowerCase())
            );

            if (duplicateAppointment) {
                Alert.alert(
                    'Appointment Already Booked',
                    `You already have an appointment with this doctor on ${dateStr} at ${duplicateAppointment.slotTime || duplicateAppointment.startTime || 'the selected time'}.`
                );
                return;
            }

            if (selectedReport) {
                await uploadSelectedReport();
            }

            const response = await bookAppointment({
                doctorId: selectedDoctor?.id,
                slotId,
                appointmentDate: dateStr,
                reasonOfAppointment: reason.trim(),
            });
            if (response?.success === false || !response?.appointmentId) {
                throw new Error(response?.message || 'Appointment confirmation was not returned by the server.');
            }
            await scheduleAppointmentReminder({
                id: String(response.appointmentId),
                role: 'patient',
                appointmentDate: dateStr,
                slotTime: selectedTimeSlot.slotTime || selectedTimeSlot.time,
                doctorName: selectedDoctor?.name,
            });
            console.log('[BookAppointment] Booking API success');
            setSlots(prev => prev.filter(slot => (slot.id || slot._id) !== (selectedTimeSlot.id || selectedTimeSlot._id)));
            setShowSuccess(true);
        } catch (error: any) {
            const status = error?.response?.status;
            const message =
                error.response?.data?.message ||
                error.response?.data?.detail ||
                error.message ||
                'Could not confirm this appointment.';

            if (status === 409) {
                console.warn('[BookAppointment] Booking conflict:', message);
                const refreshedSlots = await getAvailableSlots(String(selectedDoctor?.id), dateStr).catch(() => []);
                setSlots(refreshedSlots);
                setSelectedTimeSlot(null);
                Alert.alert('Slot Already Booked', 'This slot is no longer available. Please choose another slot.');
                return;
            }

            console.warn('[BookAppointment] Booking failed:', status || message);
            Alert.alert(
                'Booking Failed',
                message
            );
        } finally {
            setLoading(false);
        }
    };


    // --- UI COMPONENTS FOR EACH STEP ---
    const stepLabels = ['Consult', 'Date & Time', 'Confirm'];

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={step === 1 ? () => router.back() : handlePrevStep}>
                <Ionicons name="arrow-back" size={24} color="#1A237E" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Book Appointment</Text>
                <Text style={styles.stepIndicator}>{stepLabels[step - 1]} • Step {step} of 3</Text>
            </View>
            <View style={{ width: 24 }} />
        </View>
    );

    const renderStepper = () => (
        <View style={styles.stepperCard}>
            {stepLabels.map((label, index) => {
                const current = index + 1;
                const active = current <= step;
                return (
                    <View key={label} style={styles.stepperItem}>
                        <View style={[styles.stepperDot, active && styles.stepperDotActive]}>
                            <Text style={[styles.stepperDotText, active && styles.stepperDotTextActive]}>{current}</Text>
                        </View>
                        <Text style={[styles.stepperLabel, active && styles.stepperLabelActive]}>{label}</Text>
                        {index < stepLabels.length - 1 && <View style={[styles.stepperLine, current < step && styles.stepperLineActive]} />}
                    </View>
                );
            })}
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

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                <TouchableOpacity
                    style={[styles.nearMeBtn, { flex: 1, marginTop: 0 }]}
                    onPress={() => router.push({ pathname: '/NearbyHospitals', params: { automated: 'true' } })}
                >
                    <Ionicons name="business" size={17} color="#1A237E" />
                    <Text style={styles.nearMeText}>Hospitals Near Me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.nearMeBtn, { flex: 1, marginTop: 0, borderColor: '#047857' }]}
                    onPress={() => router.push('/DoctorList')}
                >
                    <FontAwesome5 name="user-md" size={15} color="#047857" />
                    <Text style={[styles.nearMeText, { color: '#047857' }]}>Doctors Near Me</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    const renderStep2 = () => (
        <Animated.View entering={SlideInRight} style={styles.stepContainer}>
            {/* Real-time Doctor Search Bar */}
            <View style={styles.drSearchBox}>
                <Ionicons name="search" size={18} color="#64748B" />
                <TextInput
                    style={styles.drSearchInput}
                    placeholder="Search doctor, hospital, or specialty..."
                    value={doctorSearchQuery}
                    onChangeText={setDoctorSearchQuery}
                    placeholderTextColor="#94A3B8"
                    clearButtonMode="while-editing"
                    autoCorrect={false}
                    returnKeyType="search"
                />
                {doctorSearchQuery ? (
                    <TouchableOpacity onPress={() => setDoctorSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={{ gap: 15 }}>
                {filteredDoctorList.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={60} color="#CBD5E1" />
                        <Text style={styles.emptyTitle}>No Doctors Available</Text>
                        <Text style={styles.emptySub}>
                            {doctorSearchQuery
                                ? `No doctors matching "${doctorSearchQuery}". Try clearing search.`
                                : 'No doctors have published slots for this specialty yet. Please try another one.'}
                        </Text>
                    </View>
                ) : (
                    filteredDoctorList.map((item) => (
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={[styles.drName, selectedDoctor?.id === item.id && styles.activeText]}>{item.name}</Text>
                                        {item.distance !== undefined && item.distance !== null ? (
                                            <View style={styles.drDistanceBadge}>
                                                <Ionicons name="location" size={10} color="#047857" />
                                                <Text style={styles.drDistanceText}>{item.distance} km</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={[styles.drSub, selectedDoctor?.id === item.id && styles.activeText]}>
                                        {item.specialty} • {item.exp}
                                    </Text>
                                    {item.hospitalName ? (
                                        <Text style={[styles.drHospitalSub, selectedDoctor?.id === item.id && styles.activeText]} numberOfLines={1}>
                                            {item.hospitalName}
                                        </Text>
                                    ) : null}
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
            <Text style={styles.label}>1. Appointment Type</Text>
            {!hasDirectDoctor && (
                <Text style={styles.subtext}>Please choose a doctor from the doctor list before booking.</Text>
            )}
            {selectedDoctor && (
                <View style={styles.selectedDoctorBox}>
                    <FontAwesome5 name="user-md" size={18} color="#1A237E" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.selectedDoctorName}>Dr. {selectedDoctor.name}</Text>
                        <Text style={styles.subtext}>{selectedDoctor.specialty} • {selectedDoctor.hospitalName}</Text>
                    </View>
                </View>
            )}
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
            <TouchableOpacity
                style={[styles.nextBtn, !selectedDoctor && { backgroundColor: '#CBD5E1' }]}
                onPress={handleNextStep}
                disabled={!selectedDoctor}
            >
                <Text style={styles.nextBtnText}>Select Slot</Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.label}>2. Pick Date & Time</Text>

            {doctorAvailableDates.length > 0 && (
                <View style={styles.quickDateSection}>
                    <Text style={styles.subLabel}>Available Doctor Dates:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickDateRow}>
                        {doctorAvailableDates.map((dateStr) => {
                            const isSelected = toDateString(selectedDate) === dateStr;
                            const count = ((selectedDoctor?.availableSlots?.length ? selectedDoctor.availableSlots : passedAvailability) || [])
                                .filter((s: any) => (s.bookingDate || s.date) === dateStr && s.status !== 'booked' && !isSlotPassed(dateStr, s.slotTime || s.time)).length;
                            return (
                                <TouchableOpacity
                                    key={dateStr}
                                    style={[styles.quickDateCard, isSelected && styles.quickDateCardActive]}
                                    onPress={() => {
                                        setSelectedDate(new Date(`${dateStr}T00:00:00`));
                                        setSelectedTimeSlot(null);
                                    }}
                                >
                                    <Text style={[styles.quickDateBadge, isSelected && styles.quickDateBadgeActive]}>
                                        {formatSlotDateBadge(dateStr)}
                                    </Text>
                                    <Text style={[styles.quickDateSub, isSelected && styles.quickDateSubActive]}>
                                        {count} slot{count !== 1 ? 's' : ''}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar" size={20} color="#1A237E" />
                <Text style={styles.dateText}>{formatSlotDateFull(toDateString(selectedDate))}</Text>
                <Ionicons name="chevron-down" size={16} color="#64748B" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(e, d) => {
                        setShowDatePicker(false);
                        if (d) {
                            setSelectedDate(d);
                            setSelectedTimeSlot(null);
                        }
                    }}
                />
            )}

            <View style={styles.slotHeaderRow}>
                <Text style={styles.subLabel}>Available Slots</Text>
                {loadingSlots && <ActivityIndicator size="small" color="#1A237E" />}
            </View>

            {loadingSlots ? (
                <View style={styles.slotLoadingContainer}>
                    <ActivityIndicator size="large" color="#1A237E" />
                    <Text style={styles.loadingText}>Loading published slots...</Text>
                </View>
            ) : (() => {
                const dateKey = toDateString(selectedDate);
                const visibleSlots = slots.filter((s: any) => !isSlotPassed(s.bookingDate || s.date || dateKey, s.slotTime || s.time));
                if (visibleSlots.length === 0) {
                    return (
                        <View style={styles.emptySlotBox}>
                            <Ionicons name="time-outline" size={36} color="#94A3B8" />
                            <Text style={styles.emptySlotTitle}>No Slots On This Date</Text>
                            <Text style={styles.emptySlotSub}>
                                {doctorAvailableDates.length > 0
                                    ? 'The doctor has published slots on other dates. Tap an available date above.'
                                    : 'This doctor has not published any slots for this date.'}
                            </Text>
                        </View>
                    );
                }
                return (
                    <View style={styles.slotGrid}>
                        {visibleSlots.map((s: any) => {
                            const isSelected = (selectedTimeSlot?.id || selectedTimeSlot?._id) === (s.id || s._id);
                            const formattedTime = formatTime12Hour(s.slotTime || s.time);
                            return (
                                <TouchableOpacity
                                    key={s._id || s.id}
                                    disabled={s.status !== 'available'}
                                    style={[
                                        styles.slotBtn,
                                        isSelected && styles.activeSlot,
                                        s.status !== 'available' && styles.disabledSlot
                                    ]}
                                    onPress={() => setSelectedTimeSlot(s)}
                                >
                                    <Ionicons 
                                        name="time-outline" 
                                        size={13} 
                                        color={isSelected ? '#fff' : (s.status !== 'available' ? '#94A3B8' : '#1A237E')} 
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text style={[
                                        styles.slotText,
                                        isSelected && styles.activeText,
                                        s.status !== 'available' && { color: '#94A3B8' }
                                    ]}>{formattedTime}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                );
            })()}

            {selectedTimeSlot && (
                <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                    <Text style={styles.nextBtnText}>Review & Confirm</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderStep5 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.label}>3. Confirm Visit</Text>
            <View style={styles.confirmSummary}>
                <Text style={styles.summaryLine}>Doctor: Dr. {selectedDoctor?.name}</Text>
                <Text style={styles.summaryLine}>Specialty: {selectedDoctor?.specialty || 'General Physician'}</Text>
                <Text style={styles.summaryLine}>Type: {consultType}</Text>
                <Text style={styles.summaryLine}>Date: {formatSlotDateFull(selectedTimeSlot?.bookingDate || selectedTimeSlot?.date || toDateString(selectedDate))}</Text>
                <Text style={styles.summaryLine}>Time: {formatTime12Hour(selectedTimeSlot?.slotTime || selectedTimeSlot?.time)}</Text>
            </View>
            <TextInput
                style={[styles.input, styles.reasonInput]}
                placeholder="Reason for visit"
                value={reason}
                onChangeText={setReason}
                multiline
                textAlignVertical="top"
            />

            <TouchableOpacity style={styles.reportButton} onPress={pickRecentReport}>
                <Ionicons name="document-attach-outline" size={20} color="#1A237E" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.reportButtonText}>
                        {selectedReport ? selectedReport.name : 'Optional: Upload recent report'}
                    </Text>
                    <Text style={styles.subtext}>PDF or image, shared with this doctor</Text>
                </View>
                {selectedReport && (
                    <TouchableOpacity onPress={() => setSelectedReport(null)}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>

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
                {renderStepper()}
                {step === 1 && renderStep3()}
                {step === 2 && renderStep4()}
                {step === 3 && renderStep5()}
            </ScrollView>

            {/* SUCCESS MODAL */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <Animated.View entering={ZoomIn} style={styles.successBox}>
                        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                        <Text style={styles.successTitle}>Booking Verified!</Text>
                        <Text style={styles.successMsg}>
                            Confirmed Dr. {selectedDoctor?.name}{'\n'}
                            on {formatSlotDateFull(selectedTimeSlot?.bookingDate || selectedTimeSlot?.date || toDateString(selectedDate))} at {formatTime12Hour(selectedTimeSlot?.slotTime || selectedTimeSlot?.time)}
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
    stepperCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    stepperItem: { flex: 1, alignItems: 'center', flexDirection: 'row' },
    stepperDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    stepperDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    stepperDotText: { color: '#64748B', fontWeight: '900', fontSize: 12 },
    stepperDotTextActive: { color: '#fff' },
    stepperLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', marginLeft: 6, flexShrink: 1 },
    stepperLabelActive: { color: colors.primary },
    stepperLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 6 },
    stepperLineActive: { backgroundColor: colors.primary },
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
    drSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 48,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    drSearchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
    },
    drDistanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        gap: 3,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    drDistanceText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#047857',
    },
    drHospitalSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
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
    selectedDoctorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E0E7FF' },
    selectedDoctorName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    quickDateSection: { marginBottom: 16 },
    quickDateRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
    quickDateCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        minWidth: 100,
    },
    quickDateCardActive: {
        backgroundColor: '#1A237E',
        borderColor: '#1A237E',
    },
    quickDateBadge: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 2,
    },
    quickDateBadgeActive: {
        color: '#FFFFFF',
    },
    quickDateSub: {
        fontSize: 11,
        color: '#059669',
        fontWeight: '700',
    },
    quickDateSubActive: {
        color: '#A7F3D0',
    },
    datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    dateText: { marginLeft: 10, fontSize: 15, fontWeight: '700', color: '#1E293B' },
    slotHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    subLabel: { fontSize: 16, fontWeight: 'bold', color: '#1A237E' },
    slotLoadingContainer: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    loadingText: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 8,
    },
    emptySlotBox: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptySlotTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 8,
    },
    emptySlotSub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 18,
    },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    slotBtn: {
        width: '31%',
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        elevation: 1,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    activeSlot: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
    disabledSlot: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.5 },
    slotText: { color: '#1A237E', fontWeight: '700', fontSize: 12 },
    input: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    reasonInput: { minHeight: 100 },
    confirmSummary: { backgroundColor: '#fff', borderRadius: 15, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    summaryLine: { color: '#1E293B', fontSize: 14, marginBottom: 8, fontWeight: '600' },
    reportButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#C7D2FE' },
    reportButtonText: { color: '#1A237E', fontWeight: '800', fontSize: 14 },
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
