import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  getMediConnectHospital,
  getMediConnectNearby,
  getMediConnectFacilities,
  MEDICONNECT_FACILITY_TYPES,
  MEDICONNECT_HOSPITAL_TYPES,
  MediConnectHospital,
  searchMediConnectHospitals,
} from '../services/mediConnectApi';
import {
  MEDICONNECT_DOCTORS,
  MEDICONNECT_LABS,
  MEDICONNECT_PACKAGES,
  MEDICONNECT_PHARMACIES,
  MediConnectDoctor,
  MediConnectLab,
  MediConnectPackage,
  MediConnectPharmacy,
} from '../services/mediConnectCareData';

const labelize = (value?: string) => (value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
type MediConnectReview = { id: string; entityType: 'hospital' | 'doctor'; entityId: string; rating: number; text: string; author: string; date: string };

export default function MediConnect() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [hospitals, setHospitals] = useState<MediConnectHospital[]>([]);
  const [query, setQuery] = useState('');
  const [hospitalType, setHospitalType] = useState('');
  const [facilityType, setFacilityType] = useState('');
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [selected, setSelected] = useState<MediConnectHospital | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [category, setCategory] = useState<'hospitals' | 'doctors' | 'labs' | 'pharmacies' | 'packages'>('hospitals');
  const [homeCollectionOnly, setHomeCollectionOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [requestedPackage, setRequestedPackage] = useState<number | null>(null);
  const [pharmacySort, setPharmacySort] = useState<'distance' | 'rating' | 'open' | 'name'>('distance');
  const [hospitalDetailTab, setHospitalDetailTab] = useState<'overview' | 'departments' | 'services' | 'insurance' | 'doctors' | 'reviews' | 'contact'>('overview');
  const [selectedDoctor, setSelectedDoctor] = useState<MediConnectDoctor | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ type: 'hospital' | 'doctor'; id: string; name: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviews, setReviews] = useState<MediConnectReview[]>([]);

  const loadNearby = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location permission is needed to show nearby hospitals.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(current.coords);
      setHospitals(await getMediConnectNearby({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        radius,
        hospitalType,
        facilityType,
      }));
    } catch (requestError: any) {
      setError(requestError?.response?.status === 404
        ? 'MediConnect is not available on the configured backend yet.'
        : 'Unable to load hospital intelligence right now.');
    } finally {
      setLoading(false);
    }
  }, [facilityType, hospitalType, radius]);

  useEffect(() => { loadNearby(); }, [loadNearby]);

  const runSearch = async () => {
    if (!query.trim()) {
      loadNearby();
      return;
    }
    setSearching(true);
    setError('');
    try {
      setHospitals(await searchMediConnectHospitals({ city: query.trim(), type: hospitalType || undefined, facility: facilityType || undefined }));
    } catch (requestError: any) {
      setError(requestError?.response?.status === 404 ? 'Hospital search is not available on the configured backend yet.' : 'Hospital search failed.');
    } finally {
      setSearching(false);
    }
  };

  const openDetails = async (hospital: MediConnectHospital) => {
    setSelected(hospital);
    setHospitalDetailTab('overview');
    setDetailLoading(true);
    try {
      const details = await getMediConnectHospital(hospital.id);
      if (!details.facilities?.length) details.facilities = await getMediConnectFacilities(hospital.id);
      setSelected(details);
    } catch {
      // Keep the summary card visible when a detail endpoint is unavailable.
    } finally {
      setDetailLoading(false);
    }
  };

  const visibleHospitals = useMemo(() => hospitals.filter((hospital) => {
    const haystack = `${hospital.name} ${hospital.city || ''} ${hospital.state || ''}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [hospitals, query]);

  const visibleCare = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (category === 'doctors') return MEDICONNECT_DOCTORS.filter((doctor) => !q || `${doctor.name} ${doctor.specialization} ${doctor.hospital}`.toLowerCase().includes(q));
    if (category === 'labs') return MEDICONNECT_LABS.filter((lab) => (!q || `${lab.name} ${lab.address} ${lab.tests.join(' ')}`.toLowerCase().includes(q)) && (!homeCollectionOnly || lab.homeCollection));
    if (category === 'pharmacies') return MEDICONNECT_PHARMACIES.filter((pharmacy) => (!q || `${pharmacy.name} ${pharmacy.address}`.toLowerCase().includes(q)) && (!deliveryOnly || pharmacy.delivery)).sort((a, b) => pharmacySort === 'rating' ? b.rating - a.rating : pharmacySort === 'open' ? Number(b.isOpen) - Number(a.isOpen) : pharmacySort === 'name' ? a.name.localeCompare(b.name) : a.distance - b.distance);
    return MEDICONNECT_PACKAGES.filter((item) => !q || `${item.name} ${item.provider} ${item.category} ${item.tests.join(' ')}`.toLowerCase().includes(q));
  }, [category, deliveryOnly, homeCollectionOnly, pharmacySort, query]);

  const loadReviews = async (type: 'hospital' | 'doctor', id: string) => {
    try {
      const raw = await AsyncStorage.getItem('mediraksha_reviews_v2');
      const all: MediConnectReview[] = raw ? JSON.parse(raw) : [];
      setReviews(all.filter(item => item.entityType === type && item.entityId === id));
    } catch { setReviews([]); }
  };

  const openReview = async (target: { type: 'hospital' | 'doctor'; id: string; name: string }) => {
    await loadReviews(target.type, target.id);
    setReviewRating(0);
    setReviewText('');
    setReviewTarget(target);
  };

  const submitReview = async () => {
    if (!reviewTarget || !reviewRating) return;
    const review: MediConnectReview = { id: `${Date.now()}`, entityType: reviewTarget.type, entityId: reviewTarget.id, rating: reviewRating, text: reviewText.trim(), author: 'You', date: new Date().toLocaleDateString('en-IN') };
    try {
      const raw = await AsyncStorage.getItem('mediraksha_reviews_v2');
      const all: MediConnectReview[] = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem('mediraksha_reviews_v2', JSON.stringify([...all, review]));
      setReviews(prev => [...prev, review]);
      setReviewTarget(null);
    } catch { Alert.alert('Review', 'Could not save the review on this device.'); }
  };

  const categories = [
    { key: 'hospitals' as const, label: 'Hospitals', icon: 'business' as const, count: visibleHospitals.length },
    { key: 'doctors' as const, label: 'Doctors', icon: 'medical' as const, count: MEDICONNECT_DOCTORS.length },
    { key: 'labs' as const, label: 'Labs & Diagnostics', icon: 'flask' as const, count: MEDICONNECT_LABS.length },
    { key: 'pharmacies' as const, label: 'Pharmacies', icon: 'medkit' as const, count: MEDICONNECT_PHARMACIES.length },
    { key: 'packages' as const, label: 'Health Packages', icon: 'cube' as const, count: MEDICONNECT_PACKAGES.length },
  ];
  const categoryTabWidth = Math.min(164, Math.max(138, Math.floor(width * 0.44)));

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Feather name="arrow-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>MediConnect</Text>
            <Text style={styles.subtitle}>Hospital intelligence around you</Text>
          </View>
          <TouchableOpacity onPress={loadNearby} style={styles.iconButton}>
            <Feather name="refresh-cw" size={19} color="#1A237E" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal style={styles.categoryTabs} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.categoryTabsContent}>
          {categories.map((item) => <TouchableOpacity key={item.key} style={[styles.categoryTab, { width: categoryTabWidth }, category === item.key && styles.categoryTabActive]} onPress={() => { Keyboard.dismiss(); setCategory(item.key); setQuery(''); }}><Ionicons name={item.icon} size={18} color={category === item.key ? '#fff' : '#64748B'} /><Text numberOfLines={2} style={[styles.categoryTabText, category === item.key && styles.categoryTabTextActive]}>{item.label}</Text><Text style={[styles.categoryCount, category === item.key && styles.categoryTabTextActive]}>{item.count}</Text></TouchableOpacity>)}
        </ScrollView>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#64748B" />
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={category === 'hospitals' ? runSearch : () => Keyboard.dismiss()} placeholder={`Search ${category === 'labs' ? 'labs or tests' : category === 'packages' ? 'packages or tests' : category}`} placeholderTextColor="#94A3B8" style={styles.searchInput} returnKeyType="search" blurOnSubmit />
          <TouchableOpacity onPress={category === 'hospitals' ? runSearch : () => setQuery(query.trim())} disabled={searching}>
            {searching ? <ActivityIndicator color="#1A237E" /> : <Text style={styles.searchAction}>{category === 'hospitals' ? 'Search' : 'Filter'}</Text>}
          </TouchableOpacity>
        </View>

        {category === 'hospitals' ? <ScrollView horizontal style={styles.filterScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
          <Chip label={`${radius} km`} active onPress={() => setRadius(radius === 10 ? 25 : 10)} />
          <Chip label="All types" active={!hospitalType} onPress={() => setHospitalType('')} />
          {MEDICONNECT_HOSPITAL_TYPES.map((type) => <Chip key={type} label={labelize(type)} active={hospitalType === type} onPress={() => setHospitalType(hospitalType === type ? '' : type)} />)}
          {MEDICONNECT_FACILITY_TYPES.map((type) => <Chip key={type} label={labelize(type)} active={facilityType === type} onPress={() => setFacilityType(facilityType === type ? '' : type)} />)}
        </ScrollView> : category === 'labs' ? <ScrollView horizontal style={styles.filterScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}><Chip label="All labs" active={!homeCollectionOnly} onPress={() => setHomeCollectionOnly(false)} /><Chip label="Home collection" active={homeCollectionOnly} onPress={() => setHomeCollectionOnly(!homeCollectionOnly)} /></ScrollView> : category === 'pharmacies' ? <>
          <ScrollView horizontal style={styles.filterScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}><Chip label="All pharmacies" active={!deliveryOnly} onPress={() => setDeliveryOnly(false)} /><Chip label="Home delivery" active={deliveryOnly} onPress={() => setDeliveryOnly(!deliveryOnly)} /></ScrollView>
          <ScrollView horizontal style={styles.sortScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sortChips}><Chip label="Nearest" active={pharmacySort === 'distance'} onPress={() => setPharmacySort('distance')} /><Chip label="Top Rated" active={pharmacySort === 'rating'} onPress={() => setPharmacySort('rating')} /><Chip label="Open Now" active={pharmacySort === 'open'} onPress={() => setPharmacySort('open')} /><Chip label="A-Z" active={pharmacySort === 'name'} onPress={() => setPharmacySort('name')} /></ScrollView>
        </> : null}

        {category === 'hospitals' ? <View style={styles.locationRow}>
          <Ionicons name="navigate" size={16} color="#047857" />
          <Text style={styles.locationText}>{location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Detecting your location...'}</Text>
          <Text style={styles.resultCount}>{visibleHospitals.length} found</Text>
        </View> : <View style={styles.locationRow}><Ionicons name="layers-outline" size={16} color="#1A237E" /><Text style={styles.locationText}>{category === 'packages' ? 'Health packages and home collection options' : 'MediConnect care providers near you'}</Text><Text style={styles.resultCount}>{visibleCare.length} found</Text></View>}

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={loadNearby}><Text style={styles.retry}>Retry</Text></TouchableOpacity></View> : null}
        {category === 'hospitals' && loading ? <View style={styles.center}><ActivityIndicator size="large" color="#1A237E" /><Text style={styles.muted}>Finding hospitals...</Text></View> : category === 'hospitals' ? (
          <FlatList
            data={visibleHospitals}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={styles.center}><Ionicons name="business-outline" size={44} color="#CBD5E1" /><Text style={styles.emptyTitle}>No hospitals found</Text><Text style={styles.muted}>Try another area or remove a filter.</Text></View>}
            renderItem={({ item }) => <HospitalCard hospital={item} onPress={() => openDetails(item)} />}
          />
        ) : (
          <FlatList
            data={visibleCare}
            keyExtractor={(item: any) => String(item.id)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={styles.center}><Ionicons name="search-outline" size={44} color="#CBD5E1" /><Text style={styles.emptyTitle}>Nothing found</Text><Text style={styles.muted}>Try another search or remove a filter.</Text></View>}
            renderItem={({ item }: any) => category === 'doctors' ? <DoctorCard doctor={item as MediConnectDoctor} onPress={() => { setSelectedDoctor(item as MediConnectDoctor); loadReviews('doctor', String(item.id)); }} /> : category === 'labs' ? <LabCard lab={item as MediConnectLab} /> : category === 'pharmacies' ? <PharmacyCard pharmacy={item as MediConnectPharmacy} /> : <PackageCard item={item as MediConnectPackage} requested={requestedPackage === item.id} onRequest={() => { setRequestedPackage(item.id); setTimeout(() => setRequestedPackage(null), 3500); }} />}
          />
        )}

        <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.detailSheet}>
              <View style={styles.sheetHandle} />
              {selected ? <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.detailContent}>
                <View style={styles.sheetHeader}><View style={{ flex: 1 }}><Text style={styles.detailTitle}>{selected.name}</Text><Text style={styles.muted}>{labelize(selected.type)}{selected.city ? ` - ${selected.city}` : ''}</Text></View><TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="close-circle" size={28} color="#94A3B8" /></TouchableOpacity></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailTabs}>
                  {(['overview', 'departments', 'services', 'insurance', 'doctors', 'reviews', 'contact'] as const).map(tab => <TouchableOpacity key={tab} style={[styles.detailTab, hospitalDetailTab === tab && styles.detailTabActive]} onPress={() => { setHospitalDetailTab(tab); if (tab === 'reviews') loadReviews('hospital', selected.id); }}><Text style={[styles.detailTabText, hospitalDetailTab === tab && styles.detailTabTextActive]}>{labelize(tab)}</Text></TouchableOpacity>)}
                </ScrollView>
                {detailLoading ? <ActivityIndicator color="#1A237E" style={{ margin: 18 }} /> : null}
                {hospitalDetailTab === 'overview' ? <><Text style={styles.detailText}>{selected.description || 'MediConnect hospital profile with structured care information.'}</Text><DetailSection title="Hospital information" values={[labelize(selected.type), selected.city, selected.state, selected.distanceKm != null ? `${selected.distanceKm.toFixed(1)} km away` : '', selected.rating != null ? `Rating ${selected.rating.toFixed(1)}` : ''].filter((value): value is string => Boolean(value))} /><DetailSection title="Specializations" values={(selected.specializations || []).map(labelize).filter((value): value is string => Boolean(value))} /></> : null}
                {hospitalDetailTab === 'departments' ? <DetailSection title="Departments" values={[(selected.departments || []).map((item: any) => item.department_name || item.name || labelize(item.department))].flat()} /> : null}
                {hospitalDetailTab === 'services' ? <DetailSection title="Services and facilities" values={(selected.facilities || []).map((item: any) => labelize(item.facility_name || item.facility_type || item.type || item.name))} /> : null}
                {hospitalDetailTab === 'insurance' ? <DetailSection title="Accepted insurance" values={selected.insurance?.length ? selected.insurance : ['Insurance information not added by this hospital yet']} /> : null}
                {hospitalDetailTab === 'doctors' ? <View>{MEDICONNECT_DOCTORS.slice(0, 8).map(doctor => <TouchableOpacity key={doctor.id} style={styles.detailDoctor} onPress={() => setSelectedDoctor(doctor)}><View style={styles.detailDoctorIcon}><Ionicons name="person" size={18} color="#047857" /></View><View style={{ flex: 1 }}><Text style={styles.detailDoctorName}>{doctor.name}</Text><Text style={styles.detailDoctorMeta}>{doctor.specialization} - {doctor.experience} years</Text></View><Ionicons name="chevron-forward" size={18} color="#94A3B8" /></TouchableOpacity>)}</View> : null}
                {hospitalDetailTab === 'reviews' ? <ReviewsBlock reviews={reviews} title={selected.name} onWrite={() => openReview({ type: 'hospital', id: selected.id, name: selected.name })} /> : null}
                {hospitalDetailTab === 'contact' ? <><Text style={styles.detailText}>{selected.address || 'Address not available'}</Text>{selected.phone ? <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`tel:${selected.phone}`)}><Ionicons name="call" size={18} color="#fff" /><Text style={styles.contactButtonText}>Call hospital</Text></TouchableOpacity> : null}<DetailSection title="Contacts" values={(selected.contacts || []).map((item: any) => [item.name, item.phone, item.email].filter(Boolean).join(' - '))} /></> : null}
              </ScrollView> : null}
            </View>
          </View>
        </Modal>
        <Modal visible={Boolean(selectedDoctor)} transparent animationType="slide" onRequestClose={() => setSelectedDoctor(null)}>
          <View style={styles.modalBackdrop}><View style={styles.doctorSheet}><View style={styles.sheetHeader}><View style={{ flex: 1 }}><Text style={styles.detailTitle}>{selectedDoctor?.name}</Text><Text style={styles.muted}>{selectedDoctor?.specialization} - {selectedDoctor?.qualification}</Text></View><TouchableOpacity onPress={() => setSelectedDoctor(null)}><Ionicons name="close-circle" size={28} color="#94A3B8" /></TouchableOpacity></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}><DetailSection title="About" values={[`${selectedDoctor?.experience || 0} years of experience`, selectedDoctor?.hospital || 'MediRaksha provider', `Languages: ${(selectedDoctor?.languages || []).join(', ')}`, `Consultation fee: INR ${selectedDoctor?.consultationFee || 0}`]} /><ReviewsBlock reviews={reviews} title={selectedDoctor?.name || 'Doctor'} onWrite={() => openReview({ type: 'doctor', id: String(selectedDoctor?.id), name: selectedDoctor?.name || 'Doctor' })} /></ScrollView></View></View>
        </Modal>
        <Modal visible={Boolean(reviewTarget)} transparent animationType="slide" onRequestClose={() => setReviewTarget(null)}>
          <View style={styles.modalBackdrop}><View style={styles.reviewSheet}><Text style={styles.reviewSheetTitle}>Rate & Review</Text><Text style={styles.reviewSheetSubtitle}>{reviewTarget?.name}</Text><View style={styles.ratingRow}>{[1, 2, 3, 4, 5].map(star => <TouchableOpacity key={star} onPress={() => setReviewRating(star)}><Ionicons name={star <= reviewRating ? 'star' : 'star-outline'} size={32} color="#F59E0B" /></TouchableOpacity>)}</View><TextInput value={reviewText} onChangeText={setReviewText} style={styles.reviewInput} placeholder="Share your experience (optional)" placeholderTextColor="#94A3B8" multiline /><View style={styles.modalActions}><TouchableOpacity style={styles.cancelReviewButton} onPress={() => setReviewTarget(null)}><Text style={styles.cancelReviewText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.submitReviewButton, !reviewRating && { opacity: 0.5 }]} disabled={!reviewRating} onPress={submitReview}><Text style={styles.submitReviewText}>Submit Review</Text></TouchableOpacity></View></View></View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.activeChip]}><Text style={[styles.chipText, active && styles.activeChipText]}>{label}</Text></TouchableOpacity>;
}

function HospitalCard({ hospital, onPress }: { hospital: MediConnectHospital; onPress: () => void }) {
  return <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={styles.cardIcon}><Ionicons name="business" size={23} color="#1A237E" /></View>
    <View style={{ flex: 1 }}><Text style={styles.cardTitle} numberOfLines={1}>{hospital.name}</Text><Text style={styles.cardMeta}>{labelize(hospital.type)}{hospital.city ? ` - ${hospital.city}` : ''}</Text><Text style={styles.cardAddress} numberOfLines={2}>{hospital.address || 'Address not available'}</Text><View style={styles.badgeRow}>{hospital.distanceKm != null ? <Text style={styles.badge}>{hospital.distanceKm.toFixed(1)} km</Text> : null}{hospital.rating != null ? <Text style={styles.badge}>Rating {hospital.rating.toFixed(1)}</Text> : null}</View></View>
    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
  </TouchableOpacity>;
}

function DoctorCard({ doctor, onPress }: { doctor: MediConnectDoctor; onPress: () => void }) {
  return <View style={styles.card}><View style={[styles.cardIcon, { backgroundColor: '#ECFDF5' }]}><Ionicons name="person" size={23} color="#047857" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{doctor.name}</Text><Text style={styles.cardMeta}>{doctor.specialization} - {doctor.qualification}</Text><Text style={styles.cardAddress}>{doctor.experience} years experience - {doctor.hospital}</Text><View style={styles.badgeRow}><Text style={styles.badge}>Rating {doctor.rating.toFixed(1)}</Text><Text style={styles.badge}>INR {doctor.consultationFee}</Text><Text style={[styles.badge, { color: doctor.available ? '#047857' : '#64748B' }]}>{doctor.available ? 'Available' : 'Busy'}</Text></View></View><TouchableOpacity style={styles.detailsLink} onPress={onPress}><Text style={styles.detailsLinkText}>About</Text></TouchableOpacity></View>;
}

function LabCard({ lab }: { lab: MediConnectLab }) {
  return <View style={styles.card}><View style={[styles.cardIcon, { backgroundColor: '#F3E8FF' }]}><Ionicons name="flask" size={23} color="#7C3AED" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{lab.name}</Text><Text style={styles.cardMeta}>{lab.distance.toFixed(1)} km - {lab.timings}</Text><Text style={styles.cardAddress}>{lab.address}</Text><View style={styles.badgeRow}><Text style={styles.badge}>From INR {lab.startingPrice}</Text><Text style={styles.badge}>Rating {lab.rating.toFixed(1)}</Text>{lab.homeCollection ? <Text style={[styles.badge, { color: '#7C3AED' }]}>Home collection</Text> : null}</View><Text style={styles.testLine}>{lab.tests.slice(0, 4).join(' - ')}</Text></View><TouchableOpacity onPress={() => Linking.openURL(`tel:${lab.phone}`)}><Ionicons name="call-outline" size={21} color="#1A237E" /></TouchableOpacity></View>;
}

function PharmacyCard({ pharmacy }: { pharmacy: MediConnectPharmacy }) {
  return <View style={styles.card}><View style={[styles.cardIcon, { backgroundColor: '#FFF1F2' }]}><Ionicons name="medkit" size={23} color="#E11D48" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{pharmacy.name}</Text><Text style={styles.cardMeta}>{pharmacy.distance.toFixed(1)} km - {pharmacy.address}</Text><View style={styles.badgeRow}><Text style={styles.badge}>{pharmacy.isOpen ? 'Open' : 'Closed'}</Text>{pharmacy.delivery ? <Text style={styles.badge}>Delivery</Text> : null}{pharmacy.is24x7 ? <Text style={styles.badge}>24/7</Text> : null}<Text style={styles.badge}>Rating {pharmacy.rating.toFixed(1)}</Text></View></View><TouchableOpacity onPress={() => Linking.openURL(`tel:${pharmacy.phone}`)}><Ionicons name="call-outline" size={21} color="#1A237E" /></TouchableOpacity></View>;
}

function PackageCard({ item, requested, onRequest }: { item: MediConnectPackage; requested: boolean; onRequest: () => void }) {
  const discount = Math.round((1 - item.price / item.originalPrice) * 100);
  return <View style={[styles.card, styles.packageCard]}><View style={[styles.cardIcon, { backgroundColor: '#FEF3C7' }]}><Ionicons name="cube" size={23} color="#D97706" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardMeta}>{item.provider} - {item.category}</Text><Text style={styles.cardAddress}>{item.description}</Text><View style={styles.priceRow}><Text style={styles.packagePrice}>INR {item.price}</Text><Text style={styles.originalPrice}>INR {item.originalPrice}</Text><Text style={styles.discount}>{discount}% OFF</Text></View><Text style={styles.testLine}>{item.testsCount} parameters - {item.tests.slice(0, 3).join(' - ')}</Text><View style={styles.packageActions}>{item.homeCollection ? <TouchableOpacity style={styles.requestButton} onPress={onRequest}><Text style={styles.requestText}>{requested ? 'Request sent' : 'Request home collection'}</Text></TouchableOpacity> : null}<TouchableOpacity style={styles.bookButton} onPress={() => Alert.alert('Health package', `${item.name} booking will be connected to the package provider.`)}><Text style={styles.bookText}>Book now</Text></TouchableOpacity></View></View></View>;
}

function DetailSection({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return <View style={styles.detailSection}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.detailTags}>{values.map((value, index) => <Text key={`${value}-${index}`} style={styles.detailTag}>{value}</Text>)}</View></View>;
}

function ReviewsBlock({ reviews, title, onWrite }: { reviews: MediConnectReview[]; title: string; onWrite: () => void }) {
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  return <View style={styles.reviewsBlock}><View style={styles.reviewSummary}><View><Text style={styles.reviewAverage}>{average ? average.toFixed(1) : '—'}</Text><Text style={styles.reviewStars}>{average ? '★★★★★' : 'No ratings yet'}</Text><Text style={styles.reviewCount}>{reviews.length} review{reviews.length === 1 ? '' : 's'}</Text></View><TouchableOpacity style={styles.writeReviewButton} onPress={onWrite}><Ionicons name="star-outline" size={16} color="#1A237E" /><Text style={styles.writeReviewText}>Write review</Text></TouchableOpacity></View>{reviews.length === 0 ? <Text style={styles.noReviews}>Be the first to share your experience with {title}.</Text> : reviews.map(review => <View key={review.id} style={styles.reviewItem}><View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{review.author.charAt(0)}</Text></View><View style={{ flex: 1 }}><View style={styles.reviewItemHeader}><Text style={styles.reviewAuthor}>{review.author}</Text><Text style={styles.reviewDate}>{review.date}</Text></View><Text style={styles.reviewItemStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>{review.text ? <Text style={styles.reviewItemText}>{review.text}</Text> : null}</View></View>)}</View>;
}

const styles = StyleSheet.create({
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  container: { flex: 1, backgroundColor: '#F5F7FB' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 40, paddingBottom: 12, gap: 20 },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#0F172A', fontSize: 24, fontWeight: '900' }, subtitle: { color: '#64748B', marginTop: 2 },
  categoryTabs: { height: 76 }, categoryTabsContent: { paddingHorizontal: 18, gap: 8, alignItems: 'center' }, categoryTab: { height: 58, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' }, categoryTabActive: { backgroundColor: '#1A237E', borderColor: '#1A237E' }, categoryTabText: { flex: 1, color: '#475569', fontSize: 13, lineHeight: 16, fontWeight: '800' }, categoryTabTextActive: { color: '#fff' }, categoryCount: { color: '#94A3B8', fontSize: 11, fontWeight: '900' },
  searchBox: { marginHorizontal: 18, marginTop: 0, marginBottom: 0, backgroundColor: '#fff', borderRadius: 17, paddingHorizontal: 14, height: 54, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 14 }, searchAction: { color: '#1A237E', fontWeight: '900' },
  filterScroll: { height: 60, marginTop: 6 }, sortScroll: { height: 56, marginTop: 4 }, chips: { height: 52, paddingHorizontal: 18, gap: 8, alignItems: 'center' }, chip: { height: 36, justifyContent: 'center', borderRadius: 18, paddingHorizontal: 13, backgroundColor: '#E2E8F0' }, activeChip: { backgroundColor: '#1A237E' }, chipText: { color: '#334155', fontSize: 12, fontWeight: '800' }, activeChipText: { color: '#fff' },
  sortChips: { height: 48, paddingHorizontal: 18, gap: 8, alignItems: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, gap: 6 }, locationText: { flex: 1, color: '#047857', fontSize: 12, fontWeight: '700' }, resultCount: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  list: { paddingHorizontal: 18, paddingBottom: 30, gap: 12 }, card: { backgroundColor: '#fff', borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E2E8F0' }, cardIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }, cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '900' }, cardMeta: { color: '#1A237E', fontSize: 12, fontWeight: '800', marginTop: 3 }, cardAddress: { color: '#64748B', fontSize: 12, marginTop: 5, lineHeight: 17 }, badgeRow: { flexDirection: 'row', gap: 7, marginTop: 8 }, badge: { backgroundColor: '#ECFDF5', color: '#047857', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: '800' },
  testLine: { color: '#64748B', fontSize: 11, marginTop: 8 }, priceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 }, packagePrice: { color: '#B45309', fontSize: 18, fontWeight: '900' }, originalPrice: { color: '#94A3B8', textDecorationLine: 'line-through', fontSize: 11 }, discount: { color: '#047857', backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, fontWeight: '900' }, packageCard: { alignItems: 'flex-start' }, packageActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }, requestButton: { backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }, requestText: { color: '#B45309', fontSize: 11, fontWeight: '900' }, bookButton: { backgroundColor: '#D97706', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, bookText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 48 }, muted: { color: '#64748B', marginTop: 8, textAlign: 'center' }, emptyTitle: { color: '#334155', fontWeight: '900', fontSize: 16, marginTop: 12 }, errorBox: { marginHorizontal: 18, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', gap: 10 }, errorText: { color: '#991B1B', flex: 1, lineHeight: 18 }, retry: { color: '#991B1B', fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' }, detailSheet: { maxHeight: '82%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 }, doctorSheet: { maxHeight: '82%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 }, reviewSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 }, detailContent: { paddingBottom: 26 }, sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 9, backgroundColor: '#CBD5E1', marginBottom: 18 }, sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, detailTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900', flexShrink: 1 }, detailText: { color: '#475569', lineHeight: 20, marginTop: 18 }, detailTabs: { gap: 8, paddingVertical: 16 }, detailTab: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#F1F5F9' }, detailTabActive: { backgroundColor: '#1A237E' }, detailTabText: { color: '#64748B', fontSize: 11, fontWeight: '900' }, detailTabTextActive: { color: '#fff' }, detailDoctor: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }, detailDoctorIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }, detailDoctorName: { color: '#0F172A', fontWeight: '900' }, detailDoctorMeta: { color: '#64748B', fontSize: 12, marginTop: 3 }, contactButton: { backgroundColor: '#047857', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }, contactButtonText: { color: '#fff', fontWeight: '900' }, detailSection: { marginTop: 20 }, sectionTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', marginBottom: 8 }, detailTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, detailTag: { backgroundColor: '#F1F5F9', color: '#475569', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, fontSize: 12 }, detailsLink: { paddingHorizontal: 8, paddingVertical: 6 }, detailsLinkText: { color: '#1A237E', fontSize: 12, fontWeight: '900' }, reviewsBlock: { marginTop: 16 }, reviewSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 14 }, reviewAverage: { color: '#92400E', fontSize: 24, fontWeight: '900' }, reviewStars: { color: '#F59E0B', fontWeight: '900', marginTop: 2 }, reviewCount: { color: '#92400E', fontSize: 11, marginTop: 3 }, writeReviewButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 }, writeReviewText: { color: '#1A237E', fontSize: 11, fontWeight: '900' }, noReviews: { color: '#64748B', textAlign: 'center', lineHeight: 19, marginTop: 18 }, reviewItem: { flexDirection: 'row', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }, reviewAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }, reviewAvatarText: { color: '#1A237E', fontWeight: '900' }, reviewItemHeader: { flexDirection: 'row', justifyContent: 'space-between' }, reviewAuthor: { color: '#0F172A', fontWeight: '900' }, reviewDate: { color: '#94A3B8', fontSize: 11 }, reviewItemStars: { color: '#F59E0B', fontSize: 12, marginTop: 3 }, reviewItemText: { color: '#475569', fontSize: 12, lineHeight: 18, marginTop: 4 }, reviewSheetTitle: { color: '#0F172A', fontSize: 20, fontWeight: '900', textAlign: 'center' }, reviewSheetSubtitle: { color: '#64748B', textAlign: 'center', marginTop: 4 }, ratingRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 }, reviewInput: { minHeight: 90, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, color: '#0F172A', marginTop: 20, textAlignVertical: 'top' }, cancelReviewButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: '#F1F5F9' }, cancelReviewText: { color: '#64748B', fontWeight: '900' }, submitReviewButton: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: '#1A237E' }, submitReviewText: { color: '#fff', fontWeight: '900' },
});
