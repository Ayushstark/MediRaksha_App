import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  LayoutAnimation,
  UIManager,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  Ionicons,
  FontAwesome5,
  MaterialIcons,
  Feather,
  AntDesign,
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import API from '../apiClient';
import { logout } from '../services/auth';

export default function PatientDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tip, setTip] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] =
    useState<'appointments' | 'activities'>('appointments');
  const [inputText, setInputText] = useState('');

  // ================= FETCH ALL DATA =================
  const fetchData = async () => {
    try {
      // 🔐 FETCH DASHBOARD DATA FROM NODE.JS BACKEND
      const profileRes = await API.get('/home/');
      setProfile(profileRes.data);

      try {
        const appRes = await API.get('/home/appointments');
        setAppointments(appRes.data.map((a: any) =>
          `${a.doctorName} - ${new Date(a.appointmentDate).toLocaleString()}`
        ));
      } catch (e) {
        setAppointments([]);
      }

      setTip('Stay hydrated and get enough sleep 🌱');
      setActivities([]); // Backend doesn't have a specific 'activities' model yet

      setLoading(false);
    } catch (error: any) {
      console.error('Dashboard error:', error);
      if (error.response?.status === 401) {
        Alert.alert('Session expired', 'Please login again.');
        router.replace('/Login');
      } else {
        Alert.alert('Error', 'Failed to load dashboard data.');
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ================= LOGOUT =================
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/Login');
    } catch (error) {
      console.error('Logout error:', error);
      router.replace('/Login');
    }
  };

  // ================= NAVIGATION HANDLERS =================
  const handleNearbyHospitals = () => {
    // Navigate to NearbyHospitals screen
    // This will show the list of hospitals
    router.push('/NearbyHospitals');
  };

  const handleEmergencyServices = () => {
    // For emergency, you can either:
    // 1. Navigate to NearbyHospitals with emergency filter
    // 2. Show emergency contact numbers
    // 3. Direct call to 108
    Alert.alert(
      'Emergency Services',
      'Choose an option:',
      [
        {
          text: 'Find Emergency Hospitals',
          onPress: () => router.push('/NearbyHospitals')
        },
        {
          text: 'Call 108',
          onPress: () => {
            // You can use Linking.openURL('tel:108') here
            Alert.alert('Calling', 'Emergency services: 108');
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // ================= UI HELPERS =================
  const toggleExpand = (section: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleAddItem = async () => {
    try {
      if (!inputText.trim()) return;

      if (modalType === 'appointments') {
        const response = await API.post('/appointments', { title: inputText });
        setAppointments(prev => [...prev, inputText]);
      } else {
        const response = await API.post('/activities', { description: inputText });
        setActivities(prev => [...prev, inputText]);
      }

      setInputText('');
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'Unable to add item');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
      </View>
    );
  }

  // ================= UI =================
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.header}>
          <FontAwesome5 name="user-circle" size={40} color="#1A237E" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.heading}>
              Welcome, {profile?.name || 'User'} 👋
            </Text>
            <Text style={styles.subtext}>Age: {profile?.age || '--'}</Text>
            <Text style={styles.subtext}>Gender: {profile?.gender || '--'}</Text>
            <Text style={styles.subtext}>Phone: {profile?.phoneNumber || '--'}</Text>
            <Text style={styles.subtext}>Email: {profile?.email || '--'}</Text>
          </View>
        </Animated.View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.bookNowCard}
            onPress={() => router.push('/BookAppointment')}
          >
            <View style={styles.bookNowLeft}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI POWERED</Text>
              </View>
              <FontAwesome5 name="calendar-check" size={24} color="#fff" />
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.bookNowTitle}>Smart Booking</Text>
                <Text style={styles.bookNowSub}>AI-driven specialist discovery</Text>
              </View>
            </View>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bookNowCard, { backgroundColor: '#4F46E5', marginTop: 15 }]}
            onPress={() => router.push('/DoctorList')}
          >
            <View style={styles.bookNowLeft}>
              <FontAwesome5 name="user-md" size={24} color="#fff" />
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.bookNowTitle}>My Doctors</Text>
                <Text style={styles.bookNowSub}>Manage & book your care team</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* APPOINTMENTS */}
        <View style={styles.summaryCard}>
          <TouchableOpacity
            onPress={() => toggleExpand('appointments')}
            style={styles.barHeader}
          >
            <Text style={styles.summaryTitle}>Upcoming Appointments</Text>
            <AntDesign
              name="plus-circle"
              size={18}
              color="#1A237E"
              onPress={() => {
                router.push('/BookAppointment');
              }}
            />
          </TouchableOpacity>
          {expanded['appointments'] &&
            appointments.map((a, i) => (
              <Text key={i} style={styles.summaryText}>
                • {a}
              </Text>
            ))}
        </View>

        {/* ACTIVITIES */}
        <View style={styles.summaryCard}>
          <TouchableOpacity
            onPress={() => toggleExpand('activities')}
            style={styles.barHeader}
          >
            <Text style={styles.summaryTitle}>Recent Activities</Text>
            <AntDesign
              name="plus-circle"
              size={18}
              color="#1A237E"
              onPress={() => {
                setModalType('activities');
                setModalVisible(true);
              }}
            />
          </TouchableOpacity>
          {expanded['activities'] &&
            activities.map((a, i) => (
              <Text key={i} style={styles.summaryText}>
                • {a}
              </Text>
            ))}
          {/* BED BOOKINGS */}
          <TouchableOpacity
            style={[styles.summaryCard, styles.bedBookingCard]}
            onPress={() => router.push('/MyBedBookings')}
          >
            <View style={styles.barHeader}>
              <View style={styles.bedBookingLeft}>
                <View style={styles.bedBookingIconBox}>
                  <FontAwesome5 name="bed" size={18} color="#fff" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.summaryTitle}>My Bed Bookings</Text>
                  <Text style={styles.bedBookingSubtext}>View & manage your reservations</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#1A237E" />
            </View>
          </TouchableOpacity>



        </View>

        {/* HEALTH TIP */}
        <View style={styles.summaryCard}>
          <TouchableOpacity
            onPress={() => toggleExpand('tip')}
            style={styles.barHeader}
          >
            <Text style={styles.summaryTitle}>Health Tip of the Day</Text>
            <AntDesign
              name={expanded['tip'] ? 'up' : 'down'}
              size={16}
              color="#1A237E"
            />
          </TouchableOpacity>
          {expanded['tip'] && (
            <Text style={styles.summaryText}>{tip}</Text>
          )}
        </View>
      </ScrollView>

      {/* LOGOUT */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <AntDesign name="logout" size={16} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* FEATURE BAR */}
      <View style={styles.featureBar}>
        <FeatureIcon
          icon={<Ionicons name="document-text" size={22} color="#fff" />}
          label="Reports"
          onPress={() => router.push('/YourReports')}
        />
        <FeatureIcon
          icon={<FontAwesome5 name="robot" size={20} color="#fff" />}
          label="AI"
          onPress={() => router.push('/AIDiagnosis')}
        />
        {/* UPDATED: Hospitals navigation */}
        <FeatureIcon
          icon={<FontAwesome5 name="user-md" size={18} color="#fff" />}
          label="Doctors"
          onPress={() => router.push('/DoctorList')}
        />
        <FeatureIcon
          icon={<Ionicons name="location" size={22} color="#fff" />}
          label="Hospitals"
          onPress={handleNearbyHospitals}
        />
        <FeatureIcon
          icon={<FontAwesome5 name="bed" size={18} color="#fff" />}
          label="My Beds"
          onPress={() => router.push('/MyBedBookings')}
        />

        {/* UPDATED: Emergency navigation */}
        <FeatureIcon
          icon={<MaterialIcons name="emergency" size={22} color="#fff" />}
          label="Emergency"
          onPress={handleEmergencyServices}
        />
        <FeatureIcon
          icon={<FontAwesome5 name="microphone" size={20} color="#fff" />}
          label="Assistant"
          onPress={() => router.push('/AIassistant')}
        />
        <FeatureIcon
          icon={<Feather name="user" size={20} color="#fff" />}
          label="Profile"
          onPress={() => router.push('/EditProfile')}
        />
      </View>

      {/* ADD MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Add {modalType === 'appointments' ? 'Appointment' : 'Activity'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Enter text"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ color: '#d32f2f' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddItem}>
                <Text style={{ color: '#1A237E', fontWeight: 'bold' }}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ================= COMPONENT =================
const FeatureIcon = ({ icon, label, onPress }: any) => (
  <TouchableOpacity style={styles.featureIcon} onPress={onPress}>
    {icon}
    <Text style={styles.iconLabel}>{label}</Text>
  </TouchableOpacity>
);

// ================= STYLES =================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F5E9' },
  contentContainer: { padding: 24, paddingBottom: 80 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  heading: { fontSize: 22, fontWeight: 'bold', color: '#1A237E' },
  subtext: { fontSize: 14, color: '#333' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    elevation: 3,
  },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A237E' },
  summaryText: { fontSize: 13, marginTop: 6 },
  logoutButton: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    flexDirection: 'row',
    backgroundColor: '#d32f2f',
    padding: 8,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', marginLeft: 6 },
  featureBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1A237E',
    paddingVertical: 10,
  },
  featureIcon: { alignItems: 'center' },
  iconLabel: { color: '#fff', fontSize: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: { backgroundColor: '#fff', padding: 20, borderRadius: 10, width: '80%' },
  modalTitle: { fontWeight: 'bold', marginBottom: 10, fontSize: 16 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 6, marginBottom: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  quickActions: { marginTop: 10, marginBottom: 10 },
  bedBookingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#1A237E',
    marginTop: 10,
  },
  bedBookingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bedBookingIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bedBookingSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  bookNowCard: {
    backgroundColor: '#1A237E',
    borderRadius: 15,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bookNowLeft: { flexDirection: 'row', alignItems: 'center' },
  bookNowTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  bookNowSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  aiBadge: {
    position: 'absolute',
    top: -10,
    right: 10,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
});
