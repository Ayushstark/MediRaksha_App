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
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { getHospitalAvailability, createBedBooking } from '../services/hospitalService';
import { getCurrentProfile } from '../services/medirakshaApi';

export default function BookBed() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { hospitalId, hospitalName } = params;

  // --- STEP STATE ---
  const [step, setStep] = useState(1);

  // --- WARD AVAILABILITY STATE ---
  const [availability, setAvailability] = useState<any>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  // --- FORM DATA ---
  const [selectedWard, setSelectedWard] = useState<any>(null);
  const [patientName, setPatientName] = useState('');
  const [patientContact, setPatientContact] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [reason, setReason] = useState('');
  const [expectedArrival, setExpectedArrival] = useState(new Date(Date.now() + 60 * 60 * 1000)); // 1 hour later default
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // --- SUBMIT & SUCCESS STATES ---
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [holdExpirationStr, setHoldExpirationStr] = useState('');
  const [countdown, setCountdown] = useState(900); // 15 minutes in seconds

  // Fetch Ward Availability & Prefill User Profile
  useEffect(() => {
    if (hospitalId) {
      setLoadingAvailability(true);
      getHospitalAvailability(hospitalId as string)
        .then((res) => {
          setAvailability(res);
          setLoadingAvailability(false);
        })
        .catch((err) => {
          console.error("Error loading availability:", err);
          Alert.alert("Error", "Failed to load hospital ward availability. Please try again.");
          setLoadingAvailability(false);
        });
    }

    // Prefill patient info from the authenticated profile
    getCurrentProfile('Patient')
      .then((profile) => {
        if (profile) {
          setPatientName(profile.name || '');
          setPatientContact(profile.phoneNumber || profile.number || '');
          setPatientAge(profile.age ? String(profile.age) : '');
          setPatientGender(profile.gender || 'Male');
        }
      })
      .catch((err) => {
        console.log("Could not prefill patient profile, utilizing manual entry:", err);
      });
  }, [hospitalId]);

  // Countdown timer for 15 minutes hold
  useEffect(() => {
    let timer: any;
    if (showSuccess && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showSuccess, countdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getWardIcon = (type: string) => {
    switch (type) {
      case 'icu':
        return <FontAwesome5 name="heartbeat" size={20} color="#EF4444" />;
      case 'emergency':
        return <MaterialIcons name="emergency" size={24} color="#EF4444" />;
      case 'pediatric':
        return <FontAwesome5 name="baby" size={20} color="#3B82F6" />;
      case 'maternity':
        return <FontAwesome5 name="baby-carriage" size={20} color="#EC4899" />;
      default:
        return <FontAwesome5 name="bed" size={20} color="#1A237E" />;
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!selectedWard) {
        Alert.alert("Selection Required", "Please select a ward type to continue.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!patientName.trim()) {
        Alert.alert("Required Field", "Please enter the patient's name.");
        return;
      }
      if (!patientContact.trim()) {
        Alert.alert("Required Field", "Please enter the contact number.");
        return;
      }
      if (!patientAge.trim()) {
        Alert.alert("Required Field", "Please enter the patient's age.");
        return;
      }
      if (!reason.trim()) {
        Alert.alert("Required Field", "Please describe the reason for bed booking.");
        return;
      }
      setStep(3);
    }
  };

  const handleBackStep = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    try {
      const payload = {
        hospitalId: hospitalId as string,
        wardId: selectedWard.wardId,
        patientName,
        patientContact,
        reason,
        expectedArrival: expectedArrival.toISOString(),
      };

      const booking = await createBedBooking(payload);
      setBookingId(booking._id);
      
      // Calculate local expiration time text
      const expireTime = new Date(booking.holdExpiresAt);
      setHoldExpirationStr(expireTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      
      // Calculate countdown seconds
      const secondsLeft = Math.max(0, Math.round((expireTime.getTime() - Date.now()) / 1000));
      setCountdown(secondsLeft > 0 ? secondsLeft : 900);

      setShowSuccess(true);
    } catch (err: any) {
      console.error("Booking error:", err);
      const errMsg = err?.response?.data?.detail || "Could not complete the bed booking. Please try again.";
      Alert.alert("Booking Failed", errMsg);
    } finally {
      setLoading(false);
    }
  };

  // --- DATETIME PICKER HANDLERS ---
  const onChangeDate = (event: any, selectedVal?: Date) => {
    setShowDatePicker(false);
    if (selectedVal) {
      const updatedDate = new Date(expectedArrival);
      updatedDate.setFullYear(selectedVal.getFullYear(), selectedVal.getMonth(), selectedVal.getDate());
      setExpectedArrival(updatedDate);
    }
  };

  const onChangeTime = (event: any, selectedVal?: Date) => {
    setShowTimePicker(false);
    if (selectedVal) {
      const updatedDate = new Date(expectedArrival);
      updatedDate.setHours(selectedVal.getHours(), selectedVal.getMinutes());
      setExpectedArrival(updatedDate);
    }
  };

  // --- RENDER FUNCTIONS FOR EACH STEP ---

  const renderStep1 = () => (
    <Animated.View entering={FadeInUp} style={styles.stepContainer}>
      <Text style={styles.sectionTitle}>1. Select Ward Type</Text>
      <Text style={styles.sectionSubtitle}>Real-time bed availability for {hospitalName}</Text>

      {loadingAvailability ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#1A237E" />
          <Text style={styles.loaderText}>Fetching live bed inventory...</Text>
        </View>
      ) : availability?.wards?.length === 0 ? (
        <Text style={styles.emptyText}>No wards configured for this hospital.</Text>
      ) : (
        <ScrollView style={styles.wardList}>
          {availability?.wards?.map((ward: any) => {
            const isSelected = selectedWard?.wardId === ward.wardId;
            const hasBeds = ward.availableBeds > 0;

            return (
              <TouchableOpacity
                key={ward.wardId}
                disabled={!hasBeds}
                style={[
                  styles.wardCard,
                  isSelected && styles.activeWardCard,
                  !hasBeds && styles.disabledWardCard,
                ]}
                onPress={() => setSelectedWard(ward)}
              >
                <View style={styles.wardRow}>
                  <View style={[styles.wardIconBox, !hasBeds && styles.disabledWardIconBox]}>
                    {getWardIcon(ward.wardType)}
                  </View>
                  <View style={styles.wardInfo}>
                    <Text style={[styles.wardLabel, !hasBeds && styles.disabledText]}>{ward.label}</Text>
                    <Text style={styles.wardSubtext}>Total capacity: {ward.totalBeds} beds</Text>
                  </View>
                  <View style={styles.bedStatusColumn}>
                    {hasBeds ? (
                      <View style={styles.availableBadge}>
                        <Text style={styles.availableBadgeText}>{ward.availableBeds} Available</Text>
                      </View>
                    ) : (
                      <View style={styles.fullBadge}>
                        <Text style={styles.fullBadgeText}>Full</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.nextBtn, !selectedWard && styles.disabledBtn]}
        onPress={handleNextStep}
        disabled={!selectedWard}
      >
        <Text style={styles.nextBtnText}>Continue to Patient Details</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={FadeInUp} style={styles.stepContainer}>
      <Text style={styles.sectionTitle}>2. Patient Information</Text>
      <Text style={styles.sectionSubtitle}>Ensure these details match your ID card for smooth admission.</Text>

      <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.inputLabel}>Patient Name</Text>
        <TextInput
          style={styles.input}
          value={patientName}
          onChangeText={setPatientName}
          placeholder="Enter full name"
          placeholderTextColor="#94A3B8"
        />

        <View style={styles.inputRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={patientAge}
              onChangeText={setPatientAge}
              placeholder="e.g. 35"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1.5 }}>
            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {['Male', 'Female', 'Other'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBtn, patientGender === g && styles.activeGenderBtn]}
                  onPress={() => setPatientGender(g)}
                >
                  <Text style={[styles.genderBtnText, patientGender === g && styles.activeGenderBtnText]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.inputLabel}>Contact Number</Text>
        <TextInput
          style={styles.input}
          value={patientContact}
          onChangeText={setPatientContact}
          placeholder="Enter phone number"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
        />

        <Text style={styles.inputLabel}>Reason for Admission</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. High fever with shortness of breath, scheduled surgery"
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
        />

        <Text style={styles.inputLabel}>Expected Arrival Date & Time</Text>
        <View style={styles.dateTimePickerRow}>
          <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar" size={18} color="#1A237E" />
            <Text style={styles.dateTimeBtnText}>{expectedArrival.toDateString()}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
            <Ionicons name="time" size={18} color="#1A237E" />
            <Text style={styles.dateTimeBtnText}>
              {expectedArrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={expectedArrival}
            mode="date"
            minimumDate={new Date()}
            onChange={onChangeDate}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={expectedArrival}
            mode="time"
            onChange={onChangeTime}
          />
        )}
      </ScrollView>

      <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
        <Text style={styles.nextBtnText}>Review Booking</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View entering={FadeInUp} style={styles.stepContainer}>
      <Text style={styles.sectionTitle}>3. Review Details</Text>
      <Text style={styles.sectionSubtitle}>Confirm the details below to complete your reservation.</Text>

      <ScrollView style={styles.reviewScroll}>
        <View style={styles.reviewCard}>
          <Text style={styles.reviewCardHeader}>{hospitalName}</Text>
          
          <View style={styles.reviewDivider} />

          <View style={styles.reviewItem}>
            <Text style={styles.reviewItemLabel}>Selected Ward</Text>
            <View style={styles.wardLabelBadge}>
              {getWardIcon(selectedWard?.wardType)}
              <Text style={styles.wardLabelBadgeText}>{selectedWard?.label}</Text>
            </View>
          </View>

          <View style={styles.reviewItem}>
            <Text style={styles.reviewItemLabel}>Patient Name</Text>
            <Text style={styles.reviewItemVal}>{patientName}</Text>
          </View>

          <View style={styles.reviewItemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewItemLabel}>Age</Text>
              <Text style={styles.reviewItemVal}>{patientAge} yrs</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reviewItemLabel}>Gender</Text>
              <Text style={styles.reviewItemVal}>{patientGender}</Text>
            </View>
          </View>

          <View style={styles.reviewItem}>
            <Text style={styles.reviewItemLabel}>Contact Number</Text>
            <Text style={styles.reviewItemVal}>{patientContact}</Text>
          </View>

          <View style={styles.reviewItem}>
            <Text style={styles.reviewItemLabel}>Admission Reason</Text>
            <Text style={styles.reviewItemVal}>{reason}</Text>
          </View>

          <View style={styles.reviewItem}>
            <Text style={styles.reviewItemLabel}>Expected Arrival</Text>
            <Text style={[styles.reviewItemVal, { color: '#4F46E5', fontWeight: 'bold' }]}>
              {expectedArrival.toDateString()} at {expectedArrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <View style={styles.holdWarningCard}>
          <Ionicons name="time" size={24} color="#B45309" />
          <View style={styles.holdWarningInfo}>
            <Text style={styles.holdWarningTitle}>Temporary 15-Minute Hold</Text>
            <Text style={styles.holdWarningText}>
              Once you confirm, a bed will be held in your name for 15 minutes. If you do not arrive and check-in by then, the hold expires automatically.
            </Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={[styles.confirmBtn, loading && styles.disabledBtn]} 
        onPress={handleConfirmBooking}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.confirmBtnText}>Confirm Bed Reservation</Text>
            <FontAwesome5 name="check-circle" size={18} color="#fff" />
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackStep} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A237E" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Book Hospital Bed</Text>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View entering={ZoomIn} style={styles.successBox}>
            <View style={styles.successIconOuter}>
              <View style={styles.successIconInner}>
                <Ionicons name="checkmark" size={48} color="#fff" />
              </View>
            </View>

            <Text style={styles.successTitle}>Bed Reserved!</Text>
            <Text style={styles.successSubtitle}>Your temporary hold is active.</Text>

            <View style={styles.qrCard}>
              <Ionicons name="qr-code" size={140} color="#1A237E" />
              <Text style={styles.qrCodeId}>BOOKING ID: {bookingId ? bookingId.substring(18).toUpperCase() : 'MED-BED'}</Text>
            </View>

            <View style={styles.holdTimerBox}>
              <Text style={styles.holdTimerLabel}>Hold Expires In</Text>
              <Text style={styles.holdTimerValue}>{formatCountdown(countdown)}</Text>
              <Text style={styles.holdTimerTime}>Will expire at {holdExpirationStr}</Text>
            </View>

            <View style={styles.successSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Hospital:</Text>
                <Text style={styles.summaryValue}>{hospitalName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ward Type:</Text>
                <Text style={styles.summaryValue}>{selectedWard?.label}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.successCloseBtn}
              onPress={() => router.replace('/PatientDashboard')}
            >
              <Text style={styles.successCloseBtnText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
  },
  stepIndicator: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  body: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  loaderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#64748B',
  },
  wardList: {
    flex: 1,
    marginBottom: 16,
  },
  wardCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  activeWardCard: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
  },
  disabledWardCard: {
    opacity: 0.6,
    backgroundColor: '#F1F5F9',
  },
  wardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  disabledWardIconBox: {
    backgroundColor: '#E2E8F0',
  },
  wardInfo: {
    flex: 1,
  },
  wardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  wardSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  disabledText: {
    color: '#94A3B8',
  },
  bedStatusColumn: {
    alignItems: 'flex-end',
  },
  availableBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  availableBadgeText: {
    color: '#065F46',
    fontWeight: '700',
    fontSize: 12,
  },
  fullBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fullBadgeText: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 12,
  },
  nextBtn: {
    backgroundColor: '#1A237E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
    elevation: 4,
  },
  disabledBtn: {
    backgroundColor: '#94A3B8',
    elevation: 0,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginRight: 8,
  },
  formScroll: {
    flex: 1,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  genderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeGenderBtn: {
    backgroundColor: '#1A237E',
  },
  genderBtnText: {
    fontWeight: '600',
    color: '#64748B',
  },
  activeGenderBtnText: {
    color: '#fff',
  },
  dateTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: 'center',
  },
  dateTimeBtnText: {
    marginLeft: 8,
    color: '#1E293B',
    fontWeight: '600',
    fontSize: 14,
  },
  dateTimeWarning: {
    fontSize: 11,
    color: '#64748B',
    marginTop: -8,
    marginBottom: 16,
    lineHeight: 16,
  },
  dateTimePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  reviewScroll: {
    flex: 1,
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  reviewCardHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A237E',
    marginBottom: 12,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  reviewItem: {
    marginBottom: 14,
  },
  reviewItemRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  reviewItemLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  reviewItemVal: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  wardLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 2,
    gap: 8,
  },
  wardLabelBadgeText: {
    color: '#1A237E',
    fontWeight: '700',
    fontSize: 14,
  },
  holdWarningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  holdWarningInfo: {
    flex: 1,
  },
  holdWarningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 4,
  },
  holdWarningText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  confirmBtn: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    elevation: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successBox: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  successIconOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A237E',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  qrCodeId: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: 1,
  },
  holdTimerBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  holdTimerLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  holdTimerValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#EF4444',
    marginVertical: 4,
  },
  holdTimerTime: {
    fontSize: 12,
    color: '#64748B',
  },
  successSummary: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  successCloseBtn: {
    backgroundColor: '#1A237E',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  successCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
