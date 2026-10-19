import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, FontAwesome5, Feather, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { AppChip, EmptyState } from '../components/ui/AppUI';
import { colors, gradients, radius, shadows, spacing } from '../constants/theme';
import { getDoctors, formatSlotDateBadge, formatTime12Hour } from '../services/medirakshaApi';

interface Doctor {
  _id: string;
  id?: string;
  name: string;
  specialization: string;
  specialty?: string;
  hospital: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  experience?: number;
  rating?: number;
  availableSlots?: {
    id?: string;
    _id?: string;
    bookingDate?: string;
    date?: string;
    slotTime?: string;
    time?: string;
    status?: string;
  }[];
}

const SPECIALTIES = ['All', 'General', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'Dermatology'];
const RADIUS_OPTIONS = [
  { label: 'All', value: 0 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
];

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export default function DoctorList() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [userLocation, setUserLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'ready' | 'denied' | 'idle'>('idle');
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [selectedRadius, setSelectedRadius] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'slots'>('distance');

  const detectLocation = async () => {
    setLocationStatus('detecting');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        setLocationLabel('Location permission denied');
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation(loc.coords);
      setLocationStatus('ready');

      // Attempt reverse geocode to get human-friendly locality/city
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          const area = [geo.district || geo.subregion || geo.city, geo.city].filter(Boolean);
          setLocationLabel(area.length > 0 ? area[0] || 'Current Location' : 'Current Location');
        } else {
          setLocationLabel('Near Current Location');
        }
      } catch {
        setLocationLabel('Near Current Location');
      }

      return loc.coords;
    } catch (err) {
      console.warn('Location detection failed:', err);
      setLocationStatus('idle');
      setLocationLabel('');
      return null;
    }
  };

  const fetchDoctors = async (coords?: Location.LocationObjectCoords | null) => {
    try {
      setLoading(true);
      const params: any = {};
      const activeCoords = coords || userLocation;
      if (activeCoords) {
        params.latitude = activeCoords.latitude;
        params.longitude = activeCoords.longitude;
      }
      const data = await getDoctors(params);

      // Compute client-side distance fallback if coordinates exist
      const doctorsWithDistance = (Array.isArray(data) ? data : []).map((doc: any) => {
        let distance = doc.distance;
        if (activeCoords && (distance === undefined || distance === null)) {
          if (doc.latitude && doc.longitude) {
            distance = parseFloat(
              haversineKm(
                activeCoords.latitude,
                activeCoords.longitude,
                Number(doc.latitude),
                Number(doc.longitude)
              ).toFixed(1)
            );
          }
        }
        return {
          ...doc,
          distance: distance !== undefined && distance !== null ? Number(distance) : undefined,
        };
      });

      setDoctors(doctorsWithDistance);
    } catch (error) {
      console.warn('Doctor discovery unavailable:', error);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const coords = await detectLocation();
      await fetchDoctors(coords);
    })();
  }, []);

  const filteredDoctors = useMemo(() => {
    let filtered = [...doctors];

    // 1. Specialty filter
    if (selectedSpecialty !== 'All') {
      filtered = filtered.filter((doc) =>
        String(doc.specialization || doc.specialty || '')
          .toLowerCase()
          .includes(selectedSpecialty.toLowerCase())
      );
    }

    // 2. Search query filter (matches doctor name, hospital, specialization, address, city)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);

      filtered = filtered.filter((doc) => {
        const text = [
          doc.name,
          doc.hospital,
          doc.specialization,
          doc.specialty,
          doc.address,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return tokens.every((token) => text.includes(token));
      });
    }

    // 3. Radius filter (if user location is active and radius > 0)
    if (selectedRadius > 0) {
      filtered = filtered.filter((doc) => {
        if (doc.distance === undefined || doc.distance === null) return true; // keep if distance unknown
        return doc.distance <= selectedRadius;
      });
    }

    // 4. Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'distance') {
        const distA = a.distance ?? 99999;
        const distB = b.distance ?? 99999;
        if (distA !== distB) return distA - distB;
      } else if (sortBy === 'rating') {
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (ratingA !== ratingB) return ratingB - ratingA;
      } else if (sortBy === 'slots') {
        const slotsA = (a.availableSlots || []).filter((s) => s.status !== 'booked').length;
        const slotsB = (b.availableSlots || []).filter((s) => s.status !== 'booked').length;
        if (slotsA !== slotsB) return slotsB - slotsA;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return filtered;
  }, [doctors, selectedSpecialty, searchQuery, selectedRadius, sortBy]);

  const openDoctorBooking = (doctor: Doctor, selectedSlot?: any) => {
    router.push({
      pathname: '/DoctorDetails',
      params: {
        doctorId: doctor.id || doctor._id,
        doctorName: doctor.name,
        specialty: doctor.specialization || doctor.specialty,
        hospitalName: doctor.hospital,
        address: doctor.address || '',
        distance: doctor.distance !== undefined ? String(doctor.distance) : '',
        availability: JSON.stringify(doctor.availableSlots || []),
        directSlot: 'true',
        initialDate: selectedSlot ? (selectedSlot.bookingDate || selectedSlot.date) : undefined,
        initialSlotId: selectedSlot ? (selectedSlot.id || selectedSlot._id) : undefined,
        initialSlotTime: selectedSlot ? (selectedSlot.slotTime || selectedSlot.time) : undefined,
      },
    });
  };

  const renderDoctorCard = ({ item }: { item: Doctor }) => {
    const availableSlots = (item.availableSlots || []).filter((slot) => slot.status !== 'booked');
    const previewSlots = availableSlots.slice(0, 3);
    const specialization = item.specialization || item.specialty || 'General Physician';
    const distanceText =
      item.distance !== undefined && item.distance !== null
        ? item.distance < 1
          ? `${Math.round(item.distance * 1000)} m away`
          : `${item.distance.toFixed(1)} km away`
        : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openDoctorBooking(item)}
        activeOpacity={0.86}
      >
        <View style={styles.cardTop}>
          <LinearGradient colors={gradients.hero} style={styles.avatar}>
            <FontAwesome5 name="user-md" size={22} color="#fff" />
          </LinearGradient>
          <View style={styles.cardInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.docName} numberOfLines={1}>Dr. {item.name}</Text>
              {distanceText ? (
                <View style={styles.distanceBadge}>
                  <Ionicons name="location" size={11} color="#047857" />
                  <Text style={styles.distanceText}>{distanceText}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.docSpec}>{specialization}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={13} color={colors.textMuted} />
              <Text style={styles.docHospital} numberOfLines={1}>
                {item.hospital || 'MediRaksha Clinic'}
              </Text>
            </View>
            {item.address ? (
              <View style={styles.metaRow}>
                <Ionicons name="navigate-outline" size={13} color={colors.textMuted} />
                <Text style={styles.docAddress} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={styles.ratingText}>{item.rating || '4.8'}</Text>
          </View>
        </View>

        <View style={styles.slotPanel}>
          <View style={styles.slotSummary}>
            <Ionicons
              name="time-outline"
              size={15}
              color={availableSlots.length ? colors.success : colors.textSoft}
            />
            <Text style={[styles.slotSummaryText, !availableSlots.length && styles.noSlotText]}>
              {availableSlots.length
                ? `${availableSlots.length} published slot${availableSlots.length > 1 ? 's' : ''} available`
                : 'No published slots'}
            </Text>
          </View>

          {previewSlots.length > 0 && (
            <View style={styles.slotChipRow}>
              {previewSlots.map((slot) => {
                const badge = formatSlotDateBadge(slot.bookingDate || slot.date);
                const timeText = formatTime12Hour(slot.slotTime || slot.time);
                return (
                  <TouchableOpacity
                    key={slot.id || slot._id || `${slot.bookingDate}-${slot.slotTime}`}
                    style={styles.slotChip}
                    onPress={() => openDoctorBooking(item, slot)}
                  >
                    <Ionicons name="time-outline" size={11} color={colors.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.slotChipText}>
                      {badge ? `${badge} • ` : ''}{timeText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerHint}>
            {item.experience ? `${item.experience}+ yrs exp • ` : ''}Tap to select slot
          </Text>
          <View style={styles.bookButton}>
            <Text style={styles.bookButtonText}>Book Consultation</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      {/* Hero Header */}
      <LinearGradient colors={gradients.hero} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerEyebrow}>Doctor Discovery</Text>
            <TouchableOpacity onPress={detectLocation} style={styles.refreshLocBtn}>
              <Ionicons
                name={locationStatus === 'detecting' ? 'sync' : 'locate'}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Find Doctors Near You</Text>
          <Text style={styles.headerSub}>
            Search doctors around your location, filter by speciality, and book consultation slots.
          </Text>

          {/* Location Status Badge */}
          <View style={styles.locationBadgeRow}>
            <Ionicons name="location" size={14} color="#34D399" />
            <Text style={styles.locationBadgeText} numberOfLines={1}>
              {locationStatus === 'detecting'
                ? 'Detecting your GPS location...'
                : userLocation
                ? `Doctors near ${locationLabel || 'your location'}`
                : 'Tap GPS icon to find doctors near you'}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchCard}>
          <Ionicons name="search" size={18} color={colors.textSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search doctor, hospital, specialty, area..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSoft}
            clearButtonMode="while-editing"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x-circle" size={18} color={colors.textSoft} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Sort & Radius Control Row */}
      <View style={styles.controlsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlsScroll}>
          <TouchableOpacity
            style={[styles.sortPill, sortBy === 'distance' && styles.sortPillActive]}
            onPress={() => setSortBy('distance')}
          >
            <Ionicons name="navigate" size={12} color={sortBy === 'distance' ? '#fff' : '#1A237E'} />
            <Text style={[styles.sortPillText, sortBy === 'distance' && styles.sortPillTextActive]}>
              Nearest First
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortPill, sortBy === 'rating' && styles.sortPillActive]}
            onPress={() => setSortBy('rating')}
          >
            <Ionicons name="star" size={12} color={sortBy === 'rating' ? '#fff' : '#1A237E'} />
            <Text style={[styles.sortPillText, sortBy === 'rating' && styles.sortPillTextActive]}>
              Top Rated
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sortPill, sortBy === 'slots' && styles.sortPillActive]}
            onPress={() => setSortBy('slots')}
          >
            <Ionicons name="time" size={12} color={sortBy === 'slots' ? '#fff' : '#1A237E'} />
            <Text style={[styles.sortPillText, sortBy === 'slots' && styles.sortPillTextActive]}>
              Available Slots
            </Text>
          </TouchableOpacity>

          <View style={styles.controlDivider} />

          {RADIUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.radiusPill, selectedRadius === opt.value && styles.radiusPillActive]}
              onPress={() => setSelectedRadius(opt.value)}
            >
              <Text style={[styles.radiusPillText, selectedRadius === opt.value && styles.radiusPillTextActive]}>
                {opt.label === 'All' ? 'Any distance' : `< ${opt.label}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Specialty Filter Chips */}
      <View style={styles.specialtySection}>
        <FlatList
          data={SPECIALTIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.specialtyList}
          renderItem={({ item }) => (
            <AppChip
              label={item}
              active={selectedSpecialty === item}
              onPress={() => setSelectedSpecialty(item)}
            />
          )}
          keyExtractor={(item) => item}
        />
      </View>

      {/* Result Counter & Active Filters Notice */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsCount}>
          Showing {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor' : 'doctors'}
          {userLocation ? ' near you' : ''}
        </Text>
        {(searchQuery || selectedSpecialty !== 'All' || selectedRadius > 0) && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setSelectedSpecialty('All');
              setSelectedRadius(0);
            }}
          >
            <Text style={styles.resetFiltersText}>Reset filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Doctor List */}
      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Locating doctors near you...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDoctors}
          renderItem={renderDoctorCard}
          keyExtractor={(item) => String(item.id || item._id)}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="medical-outline"
              title="No doctors found"
              subtitle={
                searchQuery
                  ? `No doctors matching "${searchQuery}". Try searching a different specialty, doctor, or area.`
                  : selectedRadius > 0
                  ? `No doctors within ${selectedRadius} km. Try increasing the distance radius.`
                  : 'No doctors available under the selected speciality.'
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 16,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshLocBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '800',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  locationBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  locationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    marginTop: -16,
    zIndex: 10,
  },
  searchCard: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    height: '100%',
  },
  controlsRow: {
    paddingTop: 10,
  },
  controlsScroll: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  sortPillActive: {
    backgroundColor: '#1A237E',
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A237E',
  },
  sortPillTextActive: {
    color: '#fff',
  },
  controlDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  radiusPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  radiusPillActive: {
    backgroundColor: '#047857',
  },
  radiusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  radiusPillTextActive: {
    color: '#fff',
  },
  specialtySection: {
    paddingVertical: 8,
  },
  specialtyList: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
  },
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 6,
  },
  resultsCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  resetFiltersText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  loadingBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  docName: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    flex: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 3,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  docSpec: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '800',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  docHospital: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 4,
    flex: 1,
    fontWeight: '600',
  },
  docAddress: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
    flex: 1,
    fontWeight: '500',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  ratingText: {
    color: colors.text,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '900',
  },
  slotPanel: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  slotSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotSummaryText: {
    color: colors.success,
    marginLeft: spacing.xs,
    fontSize: 12,
    fontWeight: '900',
  },
  noSlotText: {
    color: colors.textSoft,
  },
  slotChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  slotChip: {
    backgroundColor: colors.successSoft,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  slotChipText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  footerHint: {
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
    paddingRight: spacing.sm,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
    marginRight: 4,
  },
});
