import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, FadeInDown, ZoomIn, SlideInRight, Layout } from 'react-native-reanimated';
import { getMyBedBookings, cancelBedBooking, BedBooking } from '../services/hospitalService';

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────




const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'Hold Active', color: '#B45309', bg: '#FFFBEB', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  checked_in: { label: 'Checked In', color: '#1E40AF', bg: '#DBEAFE', icon: 'log-in-outline' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
  expired: { label: 'Expired', color: '#6B7280', bg: '#F3F4F6', icon: 'timer-outline' },
};

const getWardIcon = (type: string) => {
  switch (type) {
    case 'icu':
      return <FontAwesome5 name="heartbeat" size={16} color="#EF4444" />;
    case 'emergency':
      return <MaterialIcons name="emergency" size={18} color="#EF4444" />;
    case 'pediatric':
      return <FontAwesome5 name="baby" size={16} color="#3B82F6" />;
    case 'maternity':
      return <FontAwesome5 name="baby-carriage" size={16} color="#EC4899" />;
    default:
      return <FontAwesome5 name="bed" size={16} color="#1A237E" />;
  }
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatCountdown = (seconds: number) => {
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ──────────────────────────────────────────────
// COUNTDOWN HOOK
// ──────────────────────────────────────────────

function useCountdown(targetIso: string | undefined, isActive: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!targetIso || !isActive) {
      setSecondsLeft(0);
      return;
    }

    const calc = () => Math.max(0, Math.round((new Date(targetIso).getTime() - Date.now()) / 1000));
    setSecondsLeft(calc());

    const interval = setInterval(() => {
      const remaining = calc();
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetIso, isActive]);

  return secondsLeft;
}

// ──────────────────────────────────────────────
// BOOKING CARD
// ──────────────────────────────────────────────

function BookingCard({
  booking,
  index,
  onCancel,
}: {
  booking: BedBooking;
  index: number;
  onCancel: (id: string) => void;
}) {
  const isPending = booking.status === 'pending';
  const countdown = useCountdown(booking.holdExpiresAt, isPending);
  const config = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const canCancel = ['pending', 'confirmed'].includes(booking.status);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      layout={Layout.springify()}
      style={styles.card}
    >
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: config.bg }]}>
        <View style={styles.statusBadge}>
          <Ionicons name={config.icon as any} size={16} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
        {isPending && countdown > 0 && (
          <View style={styles.countdownBadge}>
            <Ionicons name="time" size={14} color="#B45309" />
            <Text style={styles.countdownText}>{formatCountdown(countdown)}</Text>
          </View>
        )}
        {isPending && countdown <= 0 && (
          <View style={[styles.countdownBadge, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.countdownText, { color: '#991B1B' }]}>Hold Expired</Text>
          </View>
        )}
      </View>

      {/* Hospital & Ward */}
      <View style={styles.cardBody}>
        <View style={styles.hospitalRow}>
          <View style={styles.hospitalIconBox}>
            <Ionicons name="business" size={20} color="#1A237E" />
          </View>
          <View style={styles.hospitalInfo}>
            <Text style={styles.hospitalName} numberOfLines={1}>
              {booking.hospitalName || 'Hospital'}
            </Text>
            <View style={styles.wardBadge}>
              {getWardIcon((booking as any).wardType || 'general')}
              <Text style={styles.wardLabel}>{booking.wardLabel || 'Ward'}</Text>
            </View>
          </View>
        </View>

        {/* Detail Rows */}
        <View style={styles.detailGrid}>
          <View style={styles.detailItem}>
            <Ionicons name="person" size={14} color="#64748B" />
            <Text style={styles.detailText}>{booking.patientName}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="call" size={14} color="#64748B" />
            <Text style={styles.detailText}>{booking.patientContact}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="document-text" size={14} color="#64748B" />
            <Text style={styles.detailText} numberOfLines={1}>{booking.reason}</Text>
          </View>
          {booking.expectedArrival && (
            <View style={styles.detailItem}>
              <Ionicons name="airplane" size={14} color="#64748B" />
              <Text style={styles.detailText}>
                Arrival: {formatDate(booking.expectedArrival)} at {formatTime(booking.expectedArrival)}
              </Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Ionicons name="calendar" size={14} color="#64748B" />
            <Text style={styles.detailText}>
              Booked: {formatDate(booking.createdAt)} at {formatTime(booking.createdAt)}
            </Text>
          </View>
        </View>

        {/* Hold Expiry Countdown for pending */}
        {isPending && countdown > 0 && (
          <View style={styles.holdBanner}>
            <View style={styles.holdBannerContent}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#B45309" />
              <View style={styles.holdBannerTextWrap}>
                <Text style={styles.holdBannerTitle}>Temporary Hold Active</Text>
                <Text style={styles.holdBannerSub}>
                  Arrive before {formatTime(booking.holdExpiresAt)} to keep your reservation
                </Text>
              </View>
            </View>
            <Text style={styles.holdTimerLarge}>{formatCountdown(countdown)}</Text>
          </View>
        )}

        {/* Booking ID */}
        <View style={styles.bookingIdRow}>
          <Text style={styles.bookingIdLabel}>ID:</Text>
          <Text style={styles.bookingIdValue}>
            {booking._id ? booking._id.substring(Math.max(0, booking._id.length - 8)).toUpperCase() : '—'}
          </Text>
        </View>

        {/* Cancel Button */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(booking._id)}
          >
            <Ionicons name="close-circle" size={18} color="#DC2626" />
            <Text style={styles.cancelBtnText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

// ──────────────────────────────────────────────
// MAIN SCREEN
// ──────────────────────────────────────────────

export default function MyBedBookings() {
  const router = useRouter();

  const [bookings, setBookings] = useState<BedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'past'>('all');

  // ─── FETCH ───
  const fetchBookings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMyBedBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error loading bed bookings:', err);
      if (!silent) {
        Alert.alert('Error', 'Failed to load your bed bookings. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings(true);
  }, [fetchBookings]);

  // ─── CANCEL ───
  const handleCancel = useCallback((bookingId: string) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this bed reservation? The held bed will be released back to the hospital.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              await cancelBedBooking(bookingId);
              // Update locally
              setBookings((prev) =>
                prev.map((b) => (b._id === bookingId ? { ...b, status: 'cancelled' as const } : b))
              );
              Alert.alert('Cancelled', 'Your bed reservation has been cancelled.');
            } catch (err: any) {
              console.error('Cancel error:', err);
              const msg = err?.response?.data?.detail || 'Could not cancel the booking. Please try again.';
              Alert.alert('Error', msg);
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  }, []);

  // ─── FILTER ───
  const safeBookings = Array.isArray(bookings) ? bookings : [];

  const filteredBookings = safeBookings.filter((b) => {
    if (activeFilter === 'active') return ['pending', 'confirmed'].includes(b.status);
    if (activeFilter === 'past') return ['cancelled', 'expired', 'checked_in'].includes(b.status);
    return true;
  });

  const activeCount = safeBookings.filter((b) => ['pending', 'confirmed'].includes(b.status)).length;
  const pastCount = safeBookings.filter((b) => ['cancelled', 'expired', 'checked_in'].includes(b.status)).length;
  // ─── RENDER ───

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1A237E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Bed Bookings</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A237E" />
          <Text style={styles.loadingText}>Loading your reservations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A237E" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Bed Bookings</Text>
          <Text style={styles.headerSubtitle}>
            {bookings.length} total · {activeCount} active
          </Text>
        </View>
        <TouchableOpacity onPress={() => fetchBookings(true)} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color="#1A237E" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'all' as const, label: 'All', count: bookings.length },
          { key: 'active' as const, label: 'Active', count: activeCount },
          { key: 'past' as const, label: 'Past', count: pastCount },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.activeFilterTab]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.activeFilterTabText]}>
              {tab.label}
            </Text>
            <View style={[styles.filterCount, activeFilter === tab.key && styles.activeFilterCount]}>
              <Text style={[styles.filterCountText, activeFilter === tab.key && styles.activeFilterCountText]}>
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1A237E']} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredBookings.length === 0 ? (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.emptyState}>
            <View style={styles.emptyIconOuter}>
              <FontAwesome5 name="bed" size={48} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'active'
                ? 'No Active Reservations'
                : activeFilter === 'past'
                  ? 'No Past Bookings'
                  : 'No Bed Bookings Yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'active'
                ? "You don't have any active bed reservations right now."
                : activeFilter === 'past'
                  ? "You haven't completed or cancelled any bookings."
                  : 'When you reserve a hospital bed, it will appear here.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => router.push('/NearbyHospitals')}
            >
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.emptyActionBtnText}>Find Nearby Hospitals</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          filteredBookings.map((booking, index) => (
            <BookingCard
              key={booking._id}
              booking={booking}
              index={index}
              onCancel={handleCancel}
            />
          ))
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Cancelling Overlay */}
      {cancellingId && (
        <Modal visible transparent animationType="fade">
          <View style={styles.cancelOverlay}>
            <Animated.View entering={ZoomIn} style={styles.cancelBox}>
              <ActivityIndicator size="large" color="#1A237E" />
              <Text style={styles.cancelBoxText}>Cancelling reservation...</Text>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ──────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────

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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backBtn: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A237E',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  activeFilterTab: {
    backgroundColor: '#1A237E',
  },
  filterTabText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#64748B',
  },
  activeFilterTabText: {
    color: '#fff',
  },
  filterCount: {
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeFilterCount: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  activeFilterCountText: {
    color: '#fff',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },

  // Scroll
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  countdownText: {
    fontWeight: '900',
    fontSize: 14,
    color: '#B45309',
    fontVariant: ['tabular-nums'],
  },
  cardBody: {
    padding: 16,
    paddingTop: 4,
  },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  hospitalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  wardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  wardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  // Details
  detailGrid: {
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },

  // Hold Banner
  holdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  holdBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  holdBannerTextWrap: {
    flex: 1,
  },
  holdBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  holdBannerSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  holdTimerLarge: {
    fontSize: 22,
    fontWeight: '900',
    color: '#B45309',
    fontVariant: ['tabular-nums'],
    marginLeft: 12,
  },

  // Booking ID
  bookingIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bookingIdLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bookingIdValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },

  // Cancel
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#DC2626',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A237E',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
    elevation: 4,
    shadowColor: '#1A237E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyActionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Cancel Overlay
  cancelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  cancelBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    gap: 16,
  },
  cancelBoxText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
});
