import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, FontAwesome5, AntDesign, Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import API from '../apiClient';
import * as SecureStore from 'expo-secure-store';
import { getCurrentProfile, getDoctorAppointments, getDoctorPatients } from '../services/medirakshaApi';
import { scheduleAppointmentReminders } from '../services/appointmentReminders';
import { colors, gradients, radius, shadows, spacing } from '../constants/theme';

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

type DrawerItem = {
  label: string;
  helper: string;
  icon: React.ReactNode;
  onPress: () => void;
};

export default function DoctorDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviews, setReviews] = useState<any>({ averageRating: 0, count: 0, reviews: [] });
  const [patientsCount, setPatientsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [connectionNotice, setConnectionNotice] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, appRes, patientRes, reviewRes] = await Promise.all([
        getCurrentProfile('Doctor'),
        getDoctorAppointments().catch(() => []),
        getDoctorPatients().catch(() => []),
        API.get('/doctor/reviews').catch(() => ({ data: { averageRating: 0, count: 0, reviews: [] } })),
      ]);

      setProfile(profileRes);
      const appList = Array.isArray(appRes) ? appRes : [];
      setAppointments(appList);

      await scheduleAppointmentReminders(
        appList
          .filter((appointment: any) => !['cancelled', 'completed'].includes(appointment.status))
          .map((appointment: any) => ({
            ...appointment,
            patientName: appointment.patient?.name || appointment.patientName,
          })),
        'doctor'
      );

      setPatientsCount(Array.isArray(patientRes) ? patientRes.length : 0);
      setReviews(reviewRes.data || { averageRating: 0, count: 0, reviews: [] });
      setLastSyncedAt(new Date());
      setConnectionNotice('');
    } catch (error: any) {
      console.warn('Doctor Dashboard unavailable:', error?.response?.status || error?.message);
      if (error.response?.status === 401) {
        Alert.alert('Session expired', 'Please login again.');
        router.replace('/Login');
      } else {
        setConnectionNotice('Showing cached clinical records. Pull to refresh when connection stabilizes.');
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

  const todayAppointments = useMemo(() => {
    const today = new Date().toDateString();
    return appointments
      .filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'missed')
      .filter((a) => new Date(`${a.appointmentDate || a.date || ''}T00:00:00`).toDateString() === today)
      .sort((a, b) => (a.slotTime || a.startTime || '').localeCompare(b.slotTime || b.startTime || ''));
  }, [appointments]);

  const pendingCount = useMemo(() => {
    return appointments.filter((a) => a.status === 'pending').length;
  }, [appointments]);

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
              await API.patch(`/doctor/meetings/${appointment._id}/complete`, {
                status: 'completed',
                reportIds: reports.map((report) => report._id),
              });
              setAppointments(prev => prev.map(item => item._id === appointment._id ? { ...item, status: 'completed' } : item));
              Alert.alert('Success', 'Checkup completed successfully.');
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

  const drawerItems: DrawerItem[] = [
    {
      label: 'Doctor Profile',
      helper: 'Specialization, fees & clinic details',
      icon: <FontAwesome5 name="user-md" size={18} color={colors.primary} />,
      onPress: () => router.push('/DoctorProfileSetup'),
    },
    {
      label: 'Slot Availability',
      helper: 'Publish single or weekly recurring slots',
      icon: <Ionicons name="calendar-outline" size={20} color={colors.primary} />,
      onPress: () => router.push('/AddAvailability'),
    },
    {
      label: 'Patient Visits & Requests',
      helper: 'Manage incoming consultation bookings',
      icon: <Ionicons name="calendar-sharp" size={20} color={colors.primary} />,
      onPress: () => router.push('/MeetingRequests'),
    },
    {
      label: 'My Patients',
      helper: 'Past consultations and health history',
      icon: <FontAwesome5 name="users" size={17} color={colors.primary} />,
      onPress: () => router.push('/MyPatients'),
    },
    {
      label: 'Shared Reports',
      helper: 'Patient records shared for review',
      icon: <Ionicons name="document-text-outline" size={20} color={colors.primary} />,
      onPress: () => router.push('/DoctorReports'),
    },
    {
      label: 'AI Clinical Assistant',
      helper: 'Differential diagnosis & drug reference',
      icon: <MaterialCommunityIcons name="robot" size={20} color={colors.primary} />,
      onPress: () => router.push('/AIassistant'),
    },
    {
      label: 'Notification Center',
      helper: 'Reminders & appointment alerts',
      icon: <Ionicons name="notifications-outline" size={20} color={colors.primary} />,
      onPress: () => router.push('/NotificationCenter' as any),
    },
    {
      label: 'Disease Encyclopedia',
      helper: 'Medical conditions & clinical guidelines',
      icon: <Ionicons name="book-outline" size={20} color={colors.primary} />,
      onPress: () => router.push('/DiseaseEncyclopedia' as any),
    },
  ];

  const closeDrawerAndRun = (onPress: () => void) => {
    setDrawerOpen(false);
    setTimeout(onPress, 180);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading clinical workspace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO GRADIENT HEADER */}
        <LinearGradient colors={gradients.hero} style={styles.hero}>
          <SafeAreaView>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setDrawerOpen(true)}>
                <Feather name="menu" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={styles.topBarRight}>
                <TouchableOpacity style={styles.profileBadgeBtn} onPress={() => router.push('/DoctorProfileSetup')}>
                  <FontAwesome5 name="user-md" size={17} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.logoutPill} onPress={handleLogout}>
                  <AntDesign name="logout" size={13} color="#fff" />
                  <Text style={styles.logoutPillText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.greetingBlock}>
              <Text style={styles.greetingEyebrow}>Doctor Clinical Workspace</Text>
              <Text style={styles.greetingTitle}>Dr. {profile?.name || 'Doctor'}</Text>
              <Text style={styles.greetingSubtitle}>
                {nextAppointment
                  ? `Next visit today at ${nextAppointment.slotTime || nextAppointment.startTime}`
                  : 'No remaining checkups scheduled for today'}
              </Text>
              <Text style={styles.syncText}>
                {lastSyncedAt
                  ? `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Syncing schedule...'}
              </Text>
            </View>

            {/* STAT PILLS */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statNumber}>{patientsCount}</Text>
                <Text style={styles.statLabel}>Patients</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statNumber}>{todayAppointments.length}</Text>
                <Text style={styles.statLabel}>Today's Visits</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statNumber}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statPill}>
                <View style={styles.statRatingRow}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.statNumber}>{reviews.averageRating ? Number(reviews.averageRating).toFixed(1) : '5.0'}</Text>
                </View>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {connectionNotice ? (
          <View style={styles.networkBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#B45309" />
            <Text style={styles.networkText}>{connectionNotice}</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          {/* PROFILE SUMMARY CARD */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <LinearGradient colors={['#EEF2FF', '#E0E7FF']} style={styles.avatarInner}>
                <FontAwesome5 name="stethoscope" size={22} color={colors.primary} />
              </LinearGradient>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileHeaderRow}>
                <Text style={styles.doctorName}>Dr. {profile?.name || 'Doctor'}</Text>
                <TouchableOpacity onPress={() => router.push('/DoctorProfileSetup')} style={styles.editPill}>
                  <Feather name="edit-2" size={12} color={colors.primary} />
                  <Text style={styles.editPillText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.doctorSpec}>{profile?.specialization || 'General Physician'}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <Ionicons name="card-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.metaBadgeText}>ID: {profile?.doctorId || profile?._id?.slice(-6) || 'VERIFIED'}</Text>
                </View>
                {profile?.age ? (
                  <View style={styles.metaBadge}>
                    <Ionicons name="person-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.metaBadgeText}>{profile.age} yrs</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* QUICK ACTION TILES */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Quick Actions</Text>
          </View>
          <View style={styles.actionGrid}>
            <ActionCard
              title="Weekly Slots"
              subtitle="Publish recurring schedule"
              icon="calendar-plus"
              iconColor="#0F766E"
              bgColor="#F0FDFA"
              onPress={() => router.push('/AddAvailability')}
            />
            <ActionCard
              title="Manage Slots"
              subtitle="Modify or cancel timings"
              icon="calendar-times"
              iconColor="#B45309"
              bgColor="#FFFBEB"
              onPress={() => router.push('/AddAvailability')}
            />
            <ActionCard
              title="My Patients"
              subtitle="Consultation history"
              icon="user-friends"
              iconColor="#2563EB"
              bgColor="#EFF6FF"
              onPress={() => router.push('/MyPatients')}
            />
            <ActionCard
              title="Medical Reports"
              subtitle="Shared patient vaults"
              icon="file-medical-alt"
              iconColor="#7C3AED"
              bgColor="#F5F3FF"
              onPress={() => router.push('/DoctorReports')}
            />
          </View>

          {/* TODAY'S APPOINTMENTS */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Today's Appointments</Text>
              <Text style={styles.sectionSub}>Confirmed & pending checkups for today</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/MeetingRequests')} style={styles.viewAllBtn}>
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {todayAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={42} color={colors.textSoft} />
              <Text style={styles.emptyCardTitle}>No checkups scheduled today</Text>
              <Text style={styles.emptyCardSub}>
                Published slots and upcoming visits booked by patients will appear here.
              </Text>
              <TouchableOpacity style={styles.emptyCardBtn} onPress={() => router.push('/AddAvailability')}>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={styles.emptyCardBtnText}>Publish New Slots</Text>
              </TouchableOpacity>
            </View>
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

          {/* PATIENT REVIEWS */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Patient Feedback & Rating</Text>
              <Text style={styles.sectionSub}>Recent reviews and experience ratings</Text>
            </View>
            <TouchableOpacity onPress={fetchData} style={styles.refreshIconBtn}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.ratingSide}>
              <Ionicons name="star" size={28} color="#F59E0B" />
              <Text style={styles.ratingScore}>{reviews.averageRating ? Number(reviews.averageRating).toFixed(1) : '5.0'}</Text>
              <Text style={styles.ratingCount}>{reviews.count || 0} reviews</Text>
            </View>
            <View style={styles.reviewContentSide}>
              {(reviews.reviews || []).slice(0, 2).map((review: any, idx: number) => (
                <View key={review._id || idx} style={styles.reviewBubble}>
                  <Text style={styles.reviewComment} numberOfLines={2}>
                    "{review.suggestion || review.comment || 'Smooth consultation and thorough diagnosis.'}"
                  </Text>
                  <View style={styles.reviewAuthorRow}>
                    <Text style={styles.reviewAuthor}>{review.patientName || 'Verified Patient'}</Text>
                    <View style={styles.starRow}>
                      <Ionicons name="star" size={11} color="#F59E0B" />
                      <Text style={styles.starText}>{review.rating || 5}/5</Text>
                    </View>
                  </View>
                </View>
              ))}
              {(!reviews.reviews || reviews.reviews.length === 0) && (
                <Text style={styles.noReviewsText}>No patient ratings yet. Feedback will appear after visits.</Text>
              )}
            </View>
          </View>

          {/* AI ASSISTANT BANNER */}
          <TouchableOpacity
            style={styles.aiBanner}
            onPress={() => router.push('/AIassistant')}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#0F172A', '#1E293B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.aiBannerGradient}
            >
              <View style={styles.aiLeft}>
                <View style={styles.aiIconWrap}>
                  <MaterialCommunityIcons name="robot" size={22} color="#38BDF8" />
                </View>
                <View style={styles.aiTextBlock}>
                  <Text style={styles.aiTitle}>AI Clinical Assistant</Text>
                  <Text style={styles.aiSubtitle}>Differential diagnosis & drug interaction check</Text>
                </View>
              </View>
              <View style={styles.aiSparkleBadge}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* BOTTOM FEATURE BAR */}
      <View style={styles.featureBar}>
        <FooterTab icon="home" label="Home" active onPress={() => {}} />
        <FooterTab icon="users" label="Patients" onPress={() => router.push('/MyPatients')} />
        <FooterTab icon="calendar-check" label="Visits" onPress={() => router.push('/MeetingRequests')} />
        <FooterTab icon="clock" label="Slots" onPress={() => router.push('/AddAvailability')} />
      </View>

      {/* DRAWER MODAL */}
      <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawerCard}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                <FontAwesome5 name="user-md" size={24} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.drawerDoctorName}>Dr. {profile?.name || 'Doctor'}</Text>
                <Text style={styles.drawerSpec}>{profile?.specialization || 'Clinical Specialist'}</Text>
              </View>
              <TouchableOpacity onPress={() => setDrawerOpen(false)} style={styles.drawerCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerList}>
              {drawerItems.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.drawerRow}
                  onPress={() => closeDrawerAndRun(item.onPress)}
                >
                  <View style={styles.drawerIconBox}>{item.icon}</View>
                  <View style={styles.drawerRowText}>
                    <Text style={styles.drawerRowLabel}>{item.label}</Text>
                    <Text style={styles.drawerRowHelper}>{item.helper}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.drawerLogoutBtn} onPress={handleLogout}>
              <AntDesign name="logout" size={16} color={colors.danger} />
              <Text style={styles.drawerLogoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ActionCard = ({ title, subtitle, icon, iconColor, bgColor, onPress }: any) => (
  <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.82}>
    <View style={[styles.actionCardIcon, { backgroundColor: bgColor }]}>
      <FontAwesome5 name={icon} size={18} color={iconColor} />
    </View>
    <Text style={styles.actionCardTitle}>{title}</Text>
    <Text style={styles.actionCardSub}>{subtitle}</Text>
  </TouchableOpacity>
);

const AppointmentCard = ({ item, completing, onOpenReport, onComplete }: any) => {
  const patient = item.patient || {};
  const reports = item.latestReports || [];
  const statusColor = item.status === 'confirmed' ? '#047857' : item.status === 'pending' ? '#B45309' : '#64748B';
  const statusBg = item.status === 'confirmed' ? '#D1FAE5' : item.status === 'pending' ? '#FEF3C7' : '#F1F5F9';

  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentTop}>
        <View style={styles.timeBadge}>
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={styles.timeBadgeText}>{item.slotTime || item.startTime || '--:--'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{item.status || 'scheduled'}</Text>
        </View>
      </View>

      <View style={styles.patientInfoRow}>
        <View style={styles.patientAvatar}>
          <Text style={styles.patientAvatarText}>{(patient.name || item.patientName || 'P').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.patientDetails}>
          <Text style={styles.patientName}>{patient.name || item.patientName || 'Unknown Patient'}</Text>
          <Text style={styles.patientMeta}>
            {[
              patient.age ? `${patient.age} yrs` : null,
              patient.gender,
              patient.phoneNumber || item.patientContact,
            ]
              .filter(Boolean)
              .join(' • ') || 'No contact specified'}
          </Text>
        </View>
      </View>

      {(item.reason || item.reasonOfAppointment) ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Visit Reason:</Text>
          <Text style={styles.reasonText} numberOfLines={2}>
            {item.reason || item.reasonOfAppointment}
          </Text>
        </View>
      ) : null}

      {/* SHARED REPORTS STRIP */}
      <View style={styles.reportSection}>
        <View style={styles.reportSectionHeader}>
          <Ionicons name="folder-open-outline" size={14} color={colors.primary} />
          <Text style={styles.reportSectionTitle}>Shared Medical Records ({reports.length})</Text>
        </View>
        {reports.length === 0 ? (
          <Text style={styles.noReportsText}>No patient records shared for this visit.</Text>
        ) : (
          <View style={styles.reportPillList}>
            {reports.map((report: any) => (
              <TouchableOpacity
                key={report._id}
                style={styles.reportPill}
                onPress={() => onOpenReport(report._id)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text" size={14} color={colors.primary} />
                <Text style={styles.reportPillText} numberOfLines={1}>
                  {report.title || report.originalFileName || 'Medical Report'}
                </Text>
                <Feather name="external-link" size={12} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* COMPLETE APPOINTMENT BUTTON */}
      <TouchableOpacity
        style={[styles.completeBtn, completing && { opacity: 0.7 }]}
        onPress={onComplete}
        disabled={completing}
        activeOpacity={0.85}
      >
        {completing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
            <Text style={styles.completeBtnText}>Complete Checkup & Self-Destruct Reports</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const FooterTab = ({ icon, label, onPress, active }: any) => (
  <TouchableOpacity style={styles.footerTab} onPress={onPress} activeOpacity={0.75}>
    <FontAwesome5 name={icon} size={17} color={active ? '#fff' : 'rgba(255,255,255,0.55)'} />
    <Text style={[styles.footerTabLabel, { color: active ? '#fff' : 'rgba(255,255,255,0.55)' }]}>
      {label}
    </Text>
    {active ? <View style={styles.activeDot} /> : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  hero: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileBadgeBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  logoutPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  greetingBlock: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  greetingEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  greetingTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  greetingSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  syncText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  statRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  networkText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    marginBottom: spacing.md,
  },
  avatarWrap: {
    marginRight: spacing.md,
  },
  avatarInner: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doctorName: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  editPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  doctorSpec: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '800',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaBadgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  actionCardSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    marginTop: spacing.sm,
  },
  emptyCardSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 260,
  },
  emptyCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginTop: spacing.md,
  },
  emptyCardBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  appointmentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  appointmentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timeBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  patientAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  patientDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  patientMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 12,
    color: colors.text,
    marginTop: 2,
    lineHeight: 16,
  },
  reportSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reportSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  noReportsText: {
    fontSize: 12,
    color: colors.textSoft,
  },
  reportPillList: {
    gap: 6,
  },
  reportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
  },
  reportPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.success,
    borderRadius: radius.sm,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    marginTop: 2,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  reviewCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
    marginBottom: spacing.sm,
  },
  ratingSide: {
    width: 85,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingRight: spacing.sm,
  },
  ratingScore: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    marginTop: 2,
  },
  ratingCount: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: 1,
  },
  reviewContentSide: {
    flex: 1,
    paddingLeft: spacing.md,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  reviewBubble: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  reviewComment: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 15,
  },
  reviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  reviewAuthor: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  noReviewsText: {
    fontSize: 12,
    color: colors.textSoft,
  },
  aiBanner: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  aiBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  aiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  aiTextBlock: {
    flex: 1,
  },
  aiTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  aiSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 1,
  },
  aiSparkleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A237E',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...shadows.card,
  },
  footerTab: {
    alignItems: 'center',
    minWidth: 54,
  },
  footerTabLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginTop: 2,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerCard: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  drawerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerDoctorName: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  drawerSpec: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
    marginTop: 1,
  },
  drawerCloseBtn: {
    padding: 4,
  },
  drawerList: {
    paddingVertical: spacing.xs,
  },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  drawerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  drawerRowText: {
    flex: 1,
  },
  drawerRowLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  drawerRowHelper: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  drawerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  drawerLogoutText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
});
