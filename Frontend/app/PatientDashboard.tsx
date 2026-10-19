import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { AntDesign, Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import API from '../apiClient';
import { logout } from '../services/auth';
import { formatAppointmentDateTime, getCurrentProfile, getPatientAppointments, isSlotPassed } from '../services/medirakshaApi';
import { scheduleAppointmentReminders } from '../services/appointmentReminders';

type DrawerItem = {
  label: string;
  helper: string;
  icon: React.ReactNode;
  onPress: () => void;
};

export default function PatientDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tip, setTip] = useState('Stay hydrated and get enough sleep.');
  const [activities, setActivities] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [connectionNotice, setConnectionNotice] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const profileData = await getCurrentProfile('Patient');
      setProfile(profileData);

      const appRes = await getPatientAppointments().catch(() => []);
      await scheduleAppointmentReminders(
        appRes.filter((appointment: any) => !['cancelled', 'completed'].includes(appointment.status)),
        'patient'
      );
      setAppointments(appRes);

      const activityRes = await API.get('/activities').catch(() => ({ data: { data: [] } }));
      const activityRows = activityRes.data?.data ?? [];
      setActivities(Array.isArray(activityRows) ? activityRows.map((item: any) => item.description) : []);
      setTip('Small steps count: drink water, take medicines on time, and keep your next appointment visible.');
      setLastSyncedAt(new Date());
      setConnectionNotice('');
    } catch (error: any) {
      console.warn('Dashboard unavailable:', error?.response?.status || error?.message);
      if (error.response?.status === 401) {
        Alert.alert('Session expired', 'Please login again.');
        router.replace('/Login');
      } else {
        setConnectionNotice('Weak network: showing the latest saved view. Pull fresh data when the connection improves.');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const upcomingAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return appointments
      .filter((appointment: any) => !['cancelled', 'completed', 'missed'].includes(String(appointment.status || '').toLowerCase()))
      .filter((appointment: any) => {
        const date = String(appointment.appointmentDate || appointment.date || '').slice(0, 10);
        const time = appointment.slotTime || appointment.startTime;
        if (date && time && isSlotPassed(date, time)) return false;
        if (!date) return true;
        return new Date(`${date}T00:00:00`).getTime() >= today.getTime();
      })
      .sort((a: any, b: any) =>
        `${a.appointmentDate || a.date || ''} ${a.slotTime || a.startTime || ''}`
          .localeCompare(`${b.appointmentDate || b.date || ''} ${b.slotTime || b.startTime || ''}`)
      );
  }, [appointments]);

  const nextAppointment = upcomingAppointments[0];
  const profileFields = [profile?.name, profile?.email, profile?.phoneNumber || profile?.number, profile?.age, profile?.gender];
  const profileCompletion = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.warn('Logout unavailable:', error);
    } finally {
      router.replace('/Login');
    }
  };

  const handleEmergencyServices = () => {
    Alert.alert('Emergency Services', 'Choose an option:', [
      { text: 'Find Emergency Hospitals', onPress: () => router.push('/NearbyHospitals') },
      { text: 'Call 108', onPress: () => Linking.openURL('tel:108').catch(() => Alert.alert('Emergency', 'Dial 108')) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const drawerItems: DrawerItem[] = [
    {
      label: 'Reports',
      helper: 'View and upload medical records',
      icon: <Ionicons name="document-text" size={20} color="#1A237E" />,
      onPress: () => router.push('/YourReports'),
    },
    {
      label: 'Notifications',
      helper: 'Appointment and care updates',
      icon: <Ionicons name="notifications" size={20} color="#1A237E" />,
      onPress: () => router.push('/NotificationCenter' as any),
    },
    {
      label: 'Disease Encyclopedia',
      helper: 'Search conditions, symptoms & guidelines',
      icon: <Ionicons name="book-outline" size={20} color="#1A237E" />,
      onPress: () => router.push('/DiseaseEncyclopedia' as any),
    },
    {
      label: 'AI Diagnosis',
      helper: 'Describe symptoms and get guidance',
      icon: <FontAwesome5 name="robot" size={18} color="#1A237E" />,
      onPress: () => router.push('/AIDiagnosis'),
    },
    {
      label: 'Doctors',
      helper: 'Browse doctors and available slots',
      icon: <FontAwesome5 name="user-md" size={18} color="#1A237E" />,
      onPress: () => router.push('/DoctorList'),
    },
    {
      label: 'Hospitals',
      helper: 'Find hospitals near you',
      icon: <Ionicons name="location" size={20} color="#1A237E" />,
      onPress: () => router.push('/NearbyHospitals'),
    },
    {
      label: 'MediConnect',
      helper: 'Hospital intelligence, facilities and departments',
      icon: <Ionicons name="pulse" size={20} color="#047857" />,
      onPress: () => router.push('/MediConnect' as any),
    },
    {
      label: 'My Beds',
      helper: 'Track bed reservations',
      icon: <FontAwesome5 name="bed" size={18} color="#1A237E" />,
      onPress: () => router.push('/MyBedBookings'),
    },
    {
      label: 'Emergency',
      helper: 'Hospitals and emergency call',
      icon: <MaterialIcons name="emergency" size={21} color="#DC2626" />,
      onPress: handleEmergencyServices,
    },
    {
      label: 'SOS',
      helper: 'Send your GPS location to emergency services',
      icon: <MaterialIcons name="sos" size={21} color="#DC2626" />,
      onPress: () => router.push('/SOS' as any),
    },
    {
      label: 'Assistant',
      helper: 'Talk to MediRaksha guide',
      icon: <FontAwesome5 name="microphone" size={18} color="#1A237E" />,
      onPress: () => router.push('/AIassistant'),
    },
    {
      label: 'Profile',
      helper: 'Edit personal information',
      icon: <Feather name="user" size={20} color="#1A237E" />,
      onPress: () => router.push('/EditProfile'),
    },
  ];

  const closeDrawerAndRun = (onPress: () => void) => {
    setDrawerOpen(false);
    setTimeout(onPress, 180);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Preparing your care dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A237E', '#3762F0']} style={styles.hero}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
              <Feather name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutPill} onPress={handleLogout}>
              <AntDesign name="logout" size={14} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.greeting}>Hi, {profile?.name || 'there'}</Text>
          <Text style={styles.heroSubtext}>Your health snapshot is ready.</Text>
          <Text style={styles.syncText}>
            {lastSyncedAt ? `Last synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sync pending'}
          </Text>

          <View style={styles.heroStats}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{upcomingAppointments.length}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{activities.length}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
          </View>
        </LinearGradient>

        {connectionNotice ? (
          <View style={styles.networkBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color="#B45309" />
            <Text style={styles.networkText}>{connectionNotice}</Text>
          </View>
        ) : null}

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user-alt" size={24} color="#1A237E" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.cardTitle}>Personal Details</Text>
            <Text style={styles.profileName}>{profile?.name || 'Patient'}</Text>
            <Text style={styles.profileMeta}>{profile?.email || 'Email not added'}</Text>
            <Text style={styles.profileMeta}>{profile?.phoneNumber || profile?.number || 'Phone not added'}</Text>
            <View style={styles.completionTrack}>
              <View style={[styles.completionFill, { width: `${profileCompletion}%` }]} />
            </View>
            <Text style={styles.completionText}>{profileCompletion}% profile complete</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => router.push('/EditProfile')}>
            <Feather name="edit-2" size={16} color="#1A237E" />
          </TouchableOpacity>
        </View>

        <View style={styles.detailGrid}>
          <InfoTile label="Age" value={profile?.age || '--'} />
          <InfoTile label="Gender" value={profile?.gender || '--'} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push({ pathname: '/BookAppointment', params: { skipDiscovery: 'true' } })}
          >
            <FontAwesome5 name="calendar-check" size={22} color="#fff" />
            <View style={styles.actionTextBlock}>
              <Text style={styles.primaryActionTitle}>Book Appointment</Text>
              <Text style={styles.primaryActionSub}>Consult a doctor faster</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/DoctorList')}>
            <FontAwesome5 name="user-md" size={20} color="#1A237E" />
            <Text style={styles.secondaryActionText}>Doctors</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.appointmentCard} onPress={() => router.push('/UpcomingAppointments')}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardTitle}>Upcoming Appointments</Text>
              <Text style={styles.mutedText}>Tap to view complete booking details</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#1A237E" />
          </View>

          {nextAppointment ? (
            <View style={styles.nextAppointmentBox}>
              <View style={styles.calendarBadge}>
                <Text style={styles.calendarMonth}>
                  {new Date(`${nextAppointment.appointmentDate || nextAppointment.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })}
                </Text>
                <Text style={styles.calendarDay}>
                  {new Date(`${nextAppointment.appointmentDate || nextAppointment.date}T00:00:00`).getDate() || '--'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appointmentDoctor}>{nextAppointment.doctorName || nextAppointment.doctor?.name || 'Doctor'}</Text>
                <Text style={styles.appointmentTime}>{formatAppointmentDateTime(nextAppointment)}</Text>
                <Text style={styles.appointmentReason} numberOfLines={1}>
                  {nextAppointment.reason || nextAppointment.reasonOfAppointment || 'Reason not added'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyAppointmentBox}>
              <Ionicons name="calendar-outline" size={28} color="#94A3B8" />
              <Text style={styles.emptyText}>No upcoming appointments yet.</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons name="sparkles" size={18} color="#047857" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Today’s Care Tip</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerScrim} activeOpacity={1} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                <FontAwesome5 name="user-alt" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.drawerName}>{profile?.name || 'Patient'}</Text>
                <Text style={styles.drawerSub}>MediRaksha menu</Text>
              </View>
            </View>

            <ScrollView style={styles.drawerMenu} contentContainerStyle={styles.drawerMenuContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {drawerItems.map((item) => (
                <TouchableOpacity key={item.label} style={styles.drawerItem} onPress={() => closeDrawerAndRun(item.onPress)}>
                  <View style={styles.drawerIcon}>{item.icon}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drawerLabel}>{item.label}</Text>
                    <Text style={styles.drawerHelper}>{item.helper}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const InfoTile = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoTile}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  contentContainer: { paddingBottom: 28 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FB' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600' },
  hero: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 54,
    paddingHorizontal: 22,
    paddingBottom: 34,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  logoutText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  greeting: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 28 },
  heroSubtext: { color: 'rgba(255,255,255,0.82)', fontSize: 15, marginTop: 6 },
  syncText: { color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '700', marginTop: 6 },
  heroStats: { flexDirection: 'row', gap: 12, marginTop: 22 },
  statPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 106,
  },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 2 },
  profileCard: {
    marginHorizontal: 20,
    marginTop: -22,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  networkBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  networkText: { color: '#92400E', fontWeight: '700', flex: 1, marginLeft: 10, lineHeight: 18 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: { flex: 1, marginLeft: 14 },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  profileName: { color: '#1A237E', fontSize: 18, fontWeight: '900', marginTop: 4 },
  profileMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  completionTrack: { height: 7, borderRadius: 999, backgroundColor: '#E2E8F0', marginTop: 10, overflow: 'hidden' },
  completionFill: { height: '100%', borderRadius: 999, backgroundColor: '#16A34A' },
  completionText: { color: '#047857', fontSize: 11, fontWeight: '900', marginTop: 5 },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailGrid: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 14 },
  infoTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  infoValue: { color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 18 },
  primaryAction: {
    flex: 1,
    minHeight: 86,
    borderRadius: 22,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  actionTextBlock: { marginLeft: 14, flex: 1 },
  primaryActionTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  primaryActionSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 3 },
  secondaryAction: {
    width: 104,
    minHeight: 86,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE5FF',
  },
  secondaryActionText: { color: '#1A237E', fontWeight: '900', marginTop: 8 },
  appointmentCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mutedText: { color: '#64748B', fontSize: 12, marginTop: 4 },
  nextAppointmentBox: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
  },
  calendarBadge: {
    width: 58,
    height: 62,
    borderRadius: 16,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  calendarMonth: { color: '#C7D2FE', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  calendarDay: { color: '#fff', fontSize: 22, fontWeight: '900' },
  appointmentDoctor: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  appointmentTime: { color: '#475569', fontSize: 13, marginTop: 4, fontWeight: '700' },
  appointmentReason: { color: '#64748B', fontSize: 12, marginTop: 4 },
  emptyAppointmentBox: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { color: '#64748B', marginTop: 8, fontWeight: '700' },
  tipCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#ECFDF5',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipText: { color: '#047857', lineHeight: 20, marginTop: 5, fontWeight: '600' },
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.45)' },
  drawer: {
    width: '82%',
    maxWidth: 360,
    height: '100%',
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
  },
  drawerMenu: { flex: 1 },
  drawerMenuContent: { paddingBottom: 28 },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 18,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  drawerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  drawerName: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  drawerSub: { color: '#64748B', marginTop: 2 },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  drawerIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  drawerLabel: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  drawerHelper: { color: '#64748B', fontSize: 12, marginTop: 2 },
});
