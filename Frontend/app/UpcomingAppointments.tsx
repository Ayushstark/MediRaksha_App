import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { AppointmentTimeline } from '../components/ui/DomainCards';
import { AppChip } from '../components/ui/AppUI';
import { formatAppointmentDateTime, getPatientAppointments } from '../services/medirakshaApi';
import { scheduleAppointmentReminders } from '../services/appointmentReminders';

export default function UpcomingAppointments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const appRes = await getPatientAppointments();
        const activeAppointments = appRes.filter((appointment: any) =>
          !['cancelled', 'completed'].includes(String(appointment.status || '').toLowerCase())
        );
        await scheduleAppointmentReminders(activeAppointments, 'patient');
        setAppointments(appRes);
      } catch (error: any) {
        console.warn('Upcoming appointments unavailable:', error?.response?.status || error?.message);
        Alert.alert('Unable to Load', 'Could not fetch your upcoming appointments right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  const sortedAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return appointments
      .filter((appointment: any) => {
        if (statusFilter !== 'all' && String(appointment.status || '').toLowerCase() !== statusFilter) return false;
        const date = String(appointment.appointmentDate || appointment.date || '').slice(0, 10);
        if (!date) return true;
        return new Date(`${date}T00:00:00`).getTime() >= today.getTime();
      })
      .sort((a: any, b: any) =>
        `${a.appointmentDate || a.date || ''} ${a.slotTime || a.startTime || ''}`
          .localeCompare(`${b.appointmentDate || b.date || ''} ${b.slotTime || b.startTime || ''}`)
      );
  }, [appointments, statusFilter]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Loading appointments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A237E', '#3762F0']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upcoming Appointments</Text>
        <Text style={styles.headerSub}>Doctor, timing, status, and your booking details in one place.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
            <AppChip
              key={status}
              label={status.charAt(0).toUpperCase() + status.slice(1)}
              active={statusFilter === status}
              onPress={() => setStatusFilter(status)}
            />
          ))}
        </ScrollView>
        {sortedAppointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={52} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No upcoming appointments</Text>
            <Text style={styles.emptySub}>Once you book a consultation, it will appear here with the details you submitted.</Text>
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => router.push({ pathname: '/BookAppointment', params: { skipDiscovery: 'true' } })}
            >
              <Text style={styles.bookButtonText}>Book Appointment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.timelineTitle}>Care timeline</Text>
            <AppointmentTimeline appointments={sortedAppointments} />
            {sortedAppointments.map((appointment: any) => (
              <AppointmentCard key={appointment.id || appointment._id} appointment={appointment} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const AppointmentCard = ({ appointment }: { appointment: any }) => {
  const doctorName = appointment.doctorName || appointment.doctor?.name || 'Doctor';
  const speciality = appointment.doctorSpeciality || appointment.speciality || appointment.specialization || appointment.doctor?.speciality;
  const reason = appointment.reason || appointment.reasonOfAppointment || 'No reason was added while booking.';
  const status = String(appointment.status || 'pending');
  const appointmentType = appointment.consultType || appointment.type || appointment.appointmentType || 'Consultation';

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.cardTop}>
        <View style={styles.doctorIcon}>
          <FontAwesome5 name="user-md" size={20} color="#1A237E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doctorName}>Dr. {doctorName}</Text>
          <Text style={styles.doctorMeta}>{speciality || appointmentType}</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.timeBox}>
        <Ionicons name="time-outline" size={18} color="#1A237E" />
        <Text style={styles.timeText}>{formatAppointmentDateTime(appointment)}</Text>
      </View>

      <View style={styles.copyBox}>
        <Text style={styles.copyTitle}>Booking details you submitted</Text>
        <DetailRow label="Reason of visit" value={reason} />
        <DetailRow label="Appointment type" value={appointmentType} />
        <DetailRow label="Patient name" value={appointment.patientName || appointment.patient?.name || 'Saved in your profile'} />
        <DetailRow label="Contact" value={appointment.patientContact || appointment.patient?.phoneNumber || 'Saved in your profile'} />
      </View>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FB' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '700' },
  header: {
    paddingTop: 54,
    paddingHorizontal: 22,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 22 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20, marginTop: 6 },
  contentContainer: { padding: 20, paddingBottom: 34 },
  filterRow: { paddingBottom: 16 },
  timelineTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900', marginTop: 14 },
  emptySub: { color: '#64748B', textAlign: 'center', lineHeight: 20, marginTop: 8 },
  bookButton: { backgroundColor: '#16A34A', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16, marginTop: 20 },
  bookButtonText: { color: '#fff', fontWeight: '900' },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  doctorIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorName: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  doctorMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  statusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: { color: '#047857', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    padding: 13,
    borderRadius: 16,
  },
  timeText: { color: '#1A237E', fontWeight: '900' },
  copyBox: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  copyTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 8 },
  detailRow: { marginTop: 9 },
  detailLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  detailValue: { color: '#0F172A', fontSize: 14, fontWeight: '700', marginTop: 3, lineHeight: 20 },
});
