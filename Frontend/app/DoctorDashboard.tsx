import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons, FontAwesome5, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../apiClient';
import * as SecureStore from 'expo-secure-store';
import { getCurrentProfile, getDoctorAppointments, getDoctorPatients } from '../services/medirakshaApi';

type Appointment = {
  _id: string;
  appointmentDate?: string;
  date?: string;
  slotTime?: string;
  startTime?: string;
  status?: string;
  patientName?: string;
  patientContact?: string;
  reasonOfAppointment?: string;
  reason?: string;
  patient?: {
    name?: string;
    age?: number;
    gender?: string;
    email?: string;
    phoneNumber?: string;
  };
  latestReports?: Array<{
    _id: string;
    title?: string;
    originalFileName?: string;
    category?: string;
    uploadedAt?: string;
  }>;
};

export default function DoctorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviews, setReviews] = useState<any>({ averageRating: 0, count: 0, reviews: [] });
  const [patientsCount, setPatientsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, appRes, patientRes, reviewRes] = await Promise.all([
        getCurrentProfile('Doctor'),
        getDoctorAppointments(),
        getDoctorPatients(),
        API.get('/doctor/reviews').catch(() => ({ data: { averageRating: 0, count: 0, reviews: [] } })),
      ]);

      setProfile(profileRes);
      setAppointments(Array.isArray(appRes) ? appRes : []);
      setPatientsCount(Array.isArray(patientRes) ? patientRes.length : 0);
      setReviews(reviewRes.data || { averageRating: 0, count: 0, reviews: [] });
    } catch (error: any) {
      console.error('Dashboard error:', error);
      if (error.response?.status === 401) {
        router.replace('/Login');
      } else {
        Alert.alert('Connection Error', error.response?.data?.detail || 'Unable to fetch dashboard data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const todayAppointments = useMemo(() => {
    const today = new Date().toDateString();
    return appointments
      .filter((a) => a.status !== 'cancelled' && a.status !== 'completed')
      .filter((a) => new Date(a.appointmentDate || a.date || '').toDateString() === today)
      .sort((a, b) => (a.slotTime || a.startTime || '').localeCompare(b.slotTime || b.startTime || ''));
  }, [appointments]);

  const pendingCount = appointments.filter((a) => a.status === 'pending').length;
  const nextAppointment = todayAppointments[0];

  const handleLogout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (e) { }
    await SecureStore.deleteItemAsync('userToken');
    router.replace('/Login');
  };

  const openReport = async (reportId: string) => {
    try {
      const response = await API.get(`/user/report/${reportId}`);
      const report = response.data?.data ?? response.data;
      Alert.alert(report.title || 'Report', `${report.originalFileName || 'Medical report'}\n${report.category || 'Uncategorized'}`);
    } catch (error: any) {
      Alert.alert('Unable to Open Report', error.response?.data?.detail || 'The report is not shared with you.');
    }
  };

  const completeAppointment = (appointment: Appointment) => {
    const reports = appointment.latestReports || [];
    Alert.alert(
      'Complete Checkup',
      reports.length
        ? 'Mark this checkup complete and self-destruct the shared reports for this appointment?'
        : 'Mark this checkup complete?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'destructive',
          onPress: async () => {
            setCompletingId(appointment._id);
            try {
              await API.patch(`/doctor/meetings/${appointment._id}/status`, {
                status: 'completed',
                reportIds: reports.map((report) => report._id),
              });
              setAppointments(prev => prev.map(item => item._id === appointment._id ? { ...item, status: 'completed' } : item));
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Could not complete appointment.');
            } finally {
              setCompletingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient colors={['#10235F', '#2563EB']} style={styles.headerGradient}>
          <SafeAreaView>
            <View style={styles.headerContent}>
              <View style={styles.headerText}>
                <Text style={styles.welcomeText}>Today's workspace</Text>
                <Text style={styles.doctorName}>Dr. {profile?.name || 'Doctor'}</Text>
                <Text style={styles.headerSub}>{nextAppointment ? `Next: ${nextAppointment.slotTime || nextAppointment.startTime}` : 'No checkups left today'}</Text>
              </View>
              <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/DoctorProfileSetup')}>
                <FontAwesome5 name="user-md" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.statsContainer}>
              <StatCard label="Patients" value={patientsCount} icon="users" />
              <StatCard label="Today" value={todayAppointments.length} icon="calendar-day" />
              <StatCard label="Pending" value={pendingCount} icon="clock" />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          <SectionHeader title="Doctor Profile" action="Edit" onPress={() => router.push('/DoctorProfileSetup')} />
          <View style={styles.profilePanel}>
            <InfoPill label="Name" value={profile?.name ? `Dr. ${profile.name}` : 'Not set'} icon="user" />
            <InfoPill label="Unique ID" value={profile?.doctorId || profile?._id || 'Not set'} icon="id-card" />
            <InfoPill label="Age" value={profile?.age ? `${profile.age} years` : 'Not set'} icon="birthday-cake" />
            <InfoPill label="Specialization" value={profile?.specialization || 'General'} icon="stethoscope" />
          </View>

          <SectionHeader title="Today's Appointments" action="All" onPress={() => router.push('/MeetingRequests')} />
          {todayAppointments.length === 0 ? (
            <EmptyPanel icon="calendar-times" title="No appointments today" subtitle="Published slots and confirmed visits will appear here." />
          ) : (
            todayAppointments.map((item) => (
              <AppointmentCard
                key={item._id}
                item={item}
                completing={completingId === item._id}
                onOpenReport={openReport}
                onComplete={() => completeAppointment(item)}
              />
            ))
          )}

          <SectionHeader title="Patient Reviews" action="Refresh" onPress={fetchData} />
          <View style={styles.reviewPanel}>
            <View style={styles.ratingBox}>
              <Ionicons name="star" size={22} color="#F59E0B" />
              <Text style={styles.ratingValue}>{reviews.averageRating || '0.0'}</Text>
              <Text style={styles.ratingMeta}>{reviews.count || 0} reviews</Text>
            </View>
            <View style={styles.reviewList}>
              {(reviews.reviews || []).slice(0, 2).map((review: any) => (
                <View key={review._id} style={styles.reviewItem}>
                  <Text style={styles.reviewText}>{review.suggestion || review.comment || 'No suggestion added.'}</Text>
                  <Text style={styles.reviewBy}>{review.patientName || 'Patient'} - {review.rating || 0}/5</Text>
                </View>
              ))}
              {(!reviews.reviews || reviews.reviews.length === 0) && (
                <Text style={styles.mutedText}>No patient ratings yet.</Text>
              )}
            </View>
          </View>

          <SectionHeader title="Slot Management" />
          <View style={styles.actionGrid}>
            <ActionTile title="Weekly Slots" subtitle="Publish recurring schedule" icon="calendar-plus" color="#0F766E" onPress={() => router.push('/AddAvailability')} />
            <ActionTile title="Change Slots" subtitle="Cancel if busy" icon="calendar-times" color="#B45309" onPress={() => router.push('/AddAvailability')} />
            <ActionTile title="Patients" subtitle="History and contacts" icon="user-friends" color="#2563EB" onPress={() => router.push('/MyPatients')} />
            <ActionTile title="Reports" subtitle="Shared health records" icon="file-medical-alt" color="#7C3AED" onPress={() => router.push('/DoctorReports')} />
          </View>

          <TouchableOpacity style={styles.aiBanner} onPress={() => router.push('/AIassistant')}>
            <LinearGradient colors={['#111827', '#334155']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.aiBannerGradient}>
              <View style={styles.aiBannerLeft}>
                <MaterialCommunityIcons name="robot" size={24} color="#fff" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.aiTitle}>AI Assistant</Text>
                  <Text style={styles.aiSub}>Use clinical context during review</Text>
                </View>
              </View>
              <Ionicons name="sparkles" size={20} color="#F59E0B" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <AntDesign name="logout" size={16} color="#DC2626" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.featureBar}>
        <FooterIcon icon="home" label="Home" active />
        <FooterIcon icon="users" label="Patients" onPress={() => router.push('/MyPatients')} />
        <FooterIcon icon="calendar-check" label="Visits" onPress={() => router.push('/MeetingRequests')} />
        <FooterIcon icon="clock" label="Slots" onPress={() => router.push('/AddAvailability')} />
      </View>
    </View>
  );
}

const SectionHeader = ({ title, action, onPress }: any) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action && <TouchableOpacity onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></TouchableOpacity>}
  </View>
);

const StatCard = ({ label, value, icon }: any) => (
  <View style={styles.statCard}>
    <FontAwesome5 name={icon} size={15} color="#fff" />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const InfoPill = ({ label, value, icon }: any) => (
  <View style={styles.infoPill}>
    <FontAwesome5 name={icon} size={14} color="#1A237E" />
    <View style={styles.infoTextWrap}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  </View>
);

const AppointmentCard = ({ item, completing, onOpenReport, onComplete }: any) => {
  const patient = item.patient || {};
  const reports = item.latestReports || [];
  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentTop}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeText}>{item.slotTime || item.startTime || '--:--'}</Text>
          <Text style={styles.statusText}>{item.status || 'scheduled'}</Text>
        </View>
        <View style={styles.patientBlock}>
          <Text style={styles.patientName}>{patient.name || item.patientName || 'Unknown Patient'}</Text>
          <Text style={styles.patientMeta}>
            {[patient.age && `${patient.age} yrs`, patient.gender, patient.phoneNumber || item.patientContact].filter(Boolean).join(' - ') || 'No contact details'}
          </Text>
          <Text style={styles.reasonText} numberOfLines={2}>{item.reason || item.reasonOfAppointment || 'No visit reason added.'}</Text>
        </View>
      </View>

      <View style={styles.reportStrip}>
        <Text style={styles.reportTitle}>Latest Reports</Text>
        {reports.length === 0 ? (
          <Text style={styles.mutedText}>No recent reports shared.</Text>
        ) : (
          reports.map((report: any) => (
            <TouchableOpacity key={report._id} style={styles.reportChip} onPress={() => onOpenReport(report._id)}>
              <Ionicons name="document-text-outline" size={16} color="#1A237E" />
              <Text style={styles.reportChipText} numberOfLines={1}>{report.title || report.originalFileName || 'Medical report'}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.completeBtn} onPress={onComplete} disabled={completing}>
        {completing ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.completeText}>Complete Checkup and Self-Destruct Shared Reports</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const EmptyPanel = ({ icon, title, subtitle }: any) => (
  <View style={styles.emptyPanel}>
    <FontAwesome5 name={icon} size={26} color="#94A3B8" />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySub}>{subtitle}</Text>
  </View>
);

const ActionTile = ({ title, subtitle, icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.actionTile} onPress={onPress}>
    <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
      <FontAwesome5 name={icon} size={18} color={color} />
    </View>
    <Text style={styles.actionTitle}>{title}</Text>
    <Text style={styles.actionSub}>{subtitle}</Text>
  </TouchableOpacity>
);

const FooterIcon = ({ icon, label, onPress, active }: any) => (
  <TouchableOpacity style={styles.footerIcon} onPress={onPress}>
    <FontAwesome5 name={icon} size={17} color={active ? '#fff' : 'rgba(255,255,255,0.55)'} />
    <Text style={[styles.footerLabel, { color: active ? '#fff' : 'rgba(255,255,255,0.55)' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 96 },
  headerGradient: { paddingTop: Platform.OS === 'ios' ? 8 : 20, paddingBottom: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 8 },
  headerText: { flex: 1, paddingRight: 16 },
  welcomeText: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '600' },
  doctorName: { color: '#fff', fontSize: 25, fontWeight: '800', marginTop: 3 },
  headerSub: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 5 },
  profileBtn: { width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 26 },
  statCard: { alignItems: 'center', width: '31%', paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  statValue: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 4 },
  statLabel: { color: 'rgba(255,255,255,0.76)', fontSize: 11, marginTop: 2 },
  content: { padding: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  sectionAction: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  profilePanel: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  infoPill: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  infoTextWrap: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: '700' },
  infoValue: { fontSize: 15, color: '#0F172A', fontWeight: '700', marginTop: 2 },
  appointmentCard: { backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  appointmentTop: { flexDirection: 'row' },
  timeBlock: { width: 82, paddingRight: 12 },
  timeText: { color: '#1A237E', fontSize: 15, fontWeight: '800' },
  statusText: { color: '#64748B', fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  patientBlock: { flex: 1 },
  patientName: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  patientMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  reasonText: { color: '#334155', fontSize: 13, marginTop: 8, lineHeight: 18 },
  reportStrip: { marginTop: 12, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8 },
  reportTitle: { fontSize: 11, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  reportChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, marginBottom: 7 },
  reportChipText: { color: '#1A237E', fontSize: 13, fontWeight: '700', marginLeft: 7, flex: 1 },
  completeBtn: { marginTop: 12, minHeight: 44, borderRadius: 8, backgroundColor: '#047857', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  completeText: { color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 8, textAlign: 'center', flexShrink: 1 },
  emptyPanel: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 22, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyTitle: { color: '#1E293B', fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 4 },
  reviewPanel: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  ratingBox: { width: 92, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#E2E8F0', paddingRight: 12 },
  ratingValue: { color: '#0F172A', fontSize: 24, fontWeight: '900', marginTop: 3 },
  ratingMeta: { color: '#64748B', fontSize: 11, marginTop: 2 },
  reviewList: { flex: 1, paddingLeft: 12, justifyContent: 'center' },
  reviewItem: { marginBottom: 10 },
  reviewText: { color: '#334155', fontSize: 13, lineHeight: 18 },
  reviewBy: { color: '#64748B', fontSize: 11, marginTop: 3, fontWeight: '700' },
  mutedText: { color: '#94A3B8', fontSize: 13 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionTile: { width: '48%', backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  actionIcon: { width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionTitle: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  actionSub: { color: '#64748B', fontSize: 11, marginTop: 3 },
  aiBanner: { marginTop: 8, borderRadius: 8, overflow: 'hidden' },
  aiBannerGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  aiTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  aiSub: { color: 'rgba(255,255,255,0.68)', fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 8 },
  logoutText: { color: '#DC2626', fontWeight: '800', marginLeft: 9 },
  featureBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1A237E', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 13, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  footerIcon: { alignItems: 'center', minWidth: 54 },
  footerLabel: { fontSize: 10, marginTop: 4, fontWeight: '700' },
});
