import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LogBox } from "react-native";
LogBox.ignoreLogs([]); // DO NOT ignore errors
import { PLACES_KEY } from "@/constants/geoapify";
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { registerPartnerHospitals, seedNearbyPartnerHospitals } from '../services/hospitalService';

const SPECIALITIES = [
  'All', 'General', 'Cardiology', 'Orthopedics', 'Pediatrics',
  'Gynecology', 'Neurology', 'Oncology', 'Emergency'
];

type Hospital = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  speciality: string;
  address: string;
  phone?: string;
  emergency?: boolean;
  distance?: number;
  isPartner?: boolean;
  availableBeds?: number;
};

type LocationSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

const fetchLocationSuggestions = async (query: string, limit = 6): Promise<LocationSuggestion[]> => {
  if (PLACES_KEY) {
    try {
      const url =
        `https://api.geoapify.com/v1/geocode/autocomplete` +
        `?text=${encodeURIComponent(query)}` +
        `&limit=${limit}&format=json` +
        `&apiKey=${encodeURIComponent(PLACES_KEY)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Geoapify autocomplete failed');
      const data = await response.json();
      return (data.results || []).map((item: any) => ({
        id: item.place_id || `${item.lat}-${item.lon}`,
        label: item.formatted || item.address_line2 || item.address_line1,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      })).filter((item: LocationSuggestion) =>
        item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
      );
    } catch (error) {
      console.warn('Geoapify autocomplete unavailable, using fallback:', error);
    }
  }

  const fallbackUrl =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=${limit}`;
  const response = await fetch(fallbackUrl, {
    headers: { 'User-Agent': 'MediRaksha/1.0 location-search' },
  });
  if (!response.ok) throw new Error('Location search failed');
  const data = await response.json();
  return (data || []).map((item: any) => ({
    id: String(item.place_id || `${item.lat}-${item.lon}`),
    label: item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  })).filter((item: LocationSuggestion) =>
    item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
  );
};

const inferSpeciality = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('children') || lowerName.includes('pediatric')) return 'Pediatrics';
  if (lowerName.includes('heart') || lowerName.includes('cardiac')) return 'Cardiology';
  if (lowerName.includes('ortho') || lowerName.includes('bone')) return 'Orthopedics';
  if (lowerName.includes('neuro') || lowerName.includes('brain')) return 'Neurology';
  if (lowerName.includes('women') || lowerName.includes('maternity') || lowerName.includes('gyno')) return 'Gynecology';
  if (lowerName.includes('cancer') || lowerName.includes('onco')) return 'Oncology';
  if (lowerName.includes('emergency') || lowerName.includes('trauma')) return 'Emergency';
  return 'General';
};

export default function NearbyHospitals() {
  const router = useRouter();
  const { specialty, useProfileLocation } = useLocalSearchParams();
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSpeciality, setSelectedSpeciality] = useState(specialty ? (specialty as string) : 'All');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [searchRadius, setSearchRadius] = useState(5000); // 5km default
  const suppressAutocomplete = useRef(false);

  const haversineMeters = (
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ) => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const fetchHospitals = async (
    userLat: number,
    userLon: number,
    radius: number
  ) => {
    try {
      if (!PLACES_KEY) {
        throw new Error('Geoapify Places API key is not configured');
      }

      const url =
        `https://api.geoapify.com/v2/places` +
        `?categories=healthcare.hospital` +
        `&filter=circle:${userLon},${userLat},${radius}` +
        `&limit=50` +
        `&apiKey=${encodeURIComponent(PLACES_KEY)}`;

      const response = await fetch(url);

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 401) {
          throw new Error('GEOAPIFY_INVALID_KEY');
        }
        throw new Error(text);
      }

      const data = await response.json();

      const hospitalsData: Hospital[] = (data.features || []).map(
        (item: any) => ({
          id: item.properties.place_id,
          name: item.properties.name || "Unnamed Hospital",
          latitude: item.properties.lat,
          longitude: item.properties.lon,
          speciality: inferSpeciality(item.properties.name || ""),
          address:
            item.properties.address_line1 ||
            item.properties.address_line2 ||
            "Address not available",
          phone:
            item.properties["contact:phone"] ||
            item.properties.phone ||
            "",
          emergency: item.properties.categories?.includes(
            "healthcare.hospital"
          ),
        })
      );

      const hospitalsWithDistance = hospitalsData
        .map((h) => ({
          ...h,
          distance: haversineMeters(
            userLat,
            userLon,
            h.latitude,
            h.longitude
          ),
        }))
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

      const partners = await registerPartnerHospitals(hospitalsWithDistance);
      const partnerIds = new Set(partners.map((partner: any) => partner.place_id || partner.geoapifyPlaceId));
      const withPartners = hospitalsWithDistance.map((hospital) => ({
        ...hospital,
        isPartner: partnerIds.has(hospital.id),
      }));
      setHospitals(withPartners);
      setFilteredHospitals(withPartners);
    } catch (error: any) {
      console.error("Geoapify error:", error);
      try {
        const latitudeDelta = radius / 111320;
        const longitudeDelta = radius / (111320 * Math.max(Math.cos(userLat * Math.PI / 180), 0.2));
        const viewbox = [
          userLon - longitudeDelta,
          userLat + latitudeDelta,
          userLon + longitudeDelta,
          userLat - latitudeDelta,
        ].join(',');
        const osmResponse = await fetch(
          `https://nominatim.openstreetmap.org/search` +
          `?q=hospital&format=jsonv2&addressdetails=1&bounded=1` +
          `&viewbox=${encodeURIComponent(viewbox)}&limit=50`,
          {
            headers: { 'User-Agent': 'MediRaksha/1.0 hospital-search' },
          }
        );
        if (!osmResponse.ok) throw new Error('OpenStreetMap hospital search failed');
        const osmData = await osmResponse.json();
        const osmHospitals: Hospital[] = (osmData || []).slice(0, 50).flatMap((item: any) => {
          const latitude = Number(item.lat);
          const longitude = Number(item.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
          const name = item.name || String(item.display_name || 'Hospital').split(',')[0];
          return [{
            id: `osm-${item.osm_type}-${item.osm_id || item.place_id}`,
            name,
            latitude,
            longitude,
            speciality: inferSpeciality(name),
            address: item.display_name || 'Address not available',
            phone: '',
            emergency: false,
            distance: haversineMeters(userLat, userLon, latitude, longitude),
          }];
        }).sort((a: Hospital, b: Hospital) => (a.distance ?? 0) - (b.distance ?? 0));

        if (osmHospitals.length > 0) {
          const partners = await registerPartnerHospitals(osmHospitals);
          const partnerIds = new Set(partners.map((partner: any) => partner.place_id || partner.geoapifyPlaceId));
          const withPartners = osmHospitals.map(hospital => ({
            ...hospital,
            isPartner: partnerIds.has(hospital.id),
          }));
          setHospitals(withPartners);
          setFilteredHospitals(withPartners);
          return;
        }

        const localPartners = await seedNearbyPartnerHospitals(userLat, userLon);
        const fallbackHospitals = localPartners.map((hospital: any) => ({
          ...hospital,
          id: hospital.place_id || hospital.geoapifyPlaceId || hospital.id,
          isPartner: true,
          distance: haversineMeters(userLat, userLon, hospital.latitude, hospital.longitude),
        })).sort((a: Hospital, b: Hospital) => (a.distance ?? 0) - (b.distance ?? 0));
        setHospitals(fallbackHospitals);
        setFilteredHospitals(fallbackHospitals);
        Alert.alert('Showing Partner Hospitals', 'Geoapify is unavailable, so nearby MediRaksha partner hospitals are shown instead.');
      } catch (fallbackError) {
        console.error('Partner hospital fallback error:', fallbackError);
        Alert.alert('Error', 'Unable to fetch nearby hospitals. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to find nearby hospitals.');
      setLoading(false);
      return;
    }

    const userLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });

    setLocation(userLocation.coords);
    suppressAutocomplete.current = true;
    setLocationQuery('Current location');
    await fetchHospitals(
      userLocation.coords.latitude,
      userLocation.coords.longitude,
      searchRadius
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    const query = locationQuery.trim();
    if (suppressAutocomplete.current) {
      suppressAutocomplete.current = false;
      return;
    }
    if (query.length < 3 || query === 'Current location') {
      setLocationSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLocationSuggestions(await fetchLocationSuggestions(query));
      } catch (error) {
        console.warn('Location autocomplete error:', error);
        setLocationSuggestions([]);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [locationQuery]);

  useEffect(() => {
    if (location) {
      fetchHospitals(location.latitude, location.longitude, searchRadius);
    }
  }, [searchRadius]);

  useEffect(() => {
    let filtered = hospitals;

    // Filter by speciality
    if (selectedSpeciality !== 'All') {
      filtered = filtered.filter(h =>
        h.speciality.toLowerCase() === selectedSpeciality.toLowerCase()
      );
    }

    setFilteredHospitals(filtered);
  }, [selectedSpeciality, hospitals]);

  const selectLocation = async (suggestion: LocationSuggestion) => {
    suppressAutocomplete.current = true;
    setLocationQuery(suggestion.label);
    setLocationSuggestions([]);
    const coords = {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    } as Location.LocationObjectCoords;
    setLocation(coords);
    setLoading(true);
    await fetchHospitals(coords.latitude, coords.longitude, searchRadius);
  };

  const searchTypedLocation = async () => {
    const query = locationQuery.trim();
    if (!query) return;
    if (locationSuggestions.length > 0) {
      await selectLocation(locationSuggestions[0]);
      return;
    }
    setSearchingLocation(true);
    try {
      const item = (await fetchLocationSuggestions(query, 1))[0];
      if (!item) {
        Alert.alert('Location Not Found', 'Try entering a more specific city, area, landmark, or address.');
        return;
      }
      await selectLocation(item);
    } catch (error) {
      console.error('Location search error:', error);
      Alert.alert('Location Search Failed', 'Unable to find that location. Please try again.');
    } finally {
      setSearchingLocation(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (location) {
      await fetchHospitals(location.latitude, location.longitude, searchRadius);
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const handleHospitalPress = (hospital: any) => {
    console.log('Tapped hospital name:', hospital.name);
    console.log('Tapped hospital id:', hospital.id);
    router.push({
      pathname: '/HospitalDetails',
      params: {
        hospital: JSON.stringify(hospital),
        userLocation: JSON.stringify(location)
      }
    });
  };

  const handleMapView = () => {
    router.push({
      pathname: '/MapScreen',
      params: {
        hospitals: JSON.stringify(filteredHospitals),
        userLocation: JSON.stringify(location)
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Finding nearby hospitals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A237E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nearby Hospitals</Text>
        <TouchableOpacity onPress={handleMapView} style={styles.mapButton}>
          <Ionicons name="map" size={24} color="#1A237E" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search city, area, landmark, or address..."
          value={locationQuery}
          onChangeText={setLocationQuery}
          onSubmitEditing={searchTypedLocation}
          returnKeyType="search"
          placeholderTextColor="#999"
        />
        {searchingLocation ? (
          <ActivityIndicator size="small" color="#1A237E" />
        ) : locationQuery.length > 0 ? (
          <TouchableOpacity onPress={() => {
            setLocationQuery('');
            setLocationSuggestions([]);
          }}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>
      {locationSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {locationSuggestions.map(suggestion => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.suggestionRow}
              onPress={() => selectLocation(suggestion)}
            >
              <Ionicons name="location-outline" size={18} color="#1A237E" />
              <Text style={styles.suggestionText} numberOfLines={2}>{suggestion.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Radius Selector */}
      <View style={styles.radiusContainer}>
        <Text style={styles.radiusLabel}>Search Radius:</Text>
        {[2000, 5000, 10000, 20000].map(radius => (
          <TouchableOpacity
            key={radius}
            style={[
              styles.radiusButton,
              searchRadius === radius && styles.radiusButtonActive
            ]}
            onPress={() => setSearchRadius(radius)}
          >
            <Text style={[
              styles.radiusButtonText,
              searchRadius === radius && styles.radiusButtonTextActive
            ]}>
              {radius / 1000}km
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Speciality Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          data={SPECIALITIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedSpeciality === item && styles.filterButtonActive
              ]}
              onPress={() => setSelectedSpeciality(item)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedSpeciality === item && styles.filterButtonTextActive
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Results Count */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {filteredHospitals.length} hospital{filteredHospitals.length !== 1 ? 's' : ''} found
        </Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#1A237E" />
        </TouchableOpacity>
      </View>

      {/* Hospital List */}
      <FlatList
        data={filteredHospitals}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.hospitalCard}
            onPress={() => handleHospitalPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.hospitalIconContainer}>
              <FontAwesome5 name="hospital" size={24} color="#1A237E" />
              {item.emergency && (
                <View style={styles.emergencyBadge}>
                  <MaterialIcons name="emergency" size={12} color="#fff" />
                </View>
              )}
            </View>

            <View style={styles.hospitalInfo}>
              <Text style={styles.hospitalName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.isPartner && (
                <View style={styles.partnerBadge}>
                  <FontAwesome5 name="bed" size={11} color="#065F46" />
                  <Text style={styles.partnerBadgeText}>
                    Partner hospital{item.availableBeds ? ` - ${item.availableBeds} beds available` : ' - bed booking available'}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <MaterialIcons name="local-hospital" size={14} color="#666" />
                <Text style={styles.detailText}>{item.speciality}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="location" size={14} color="#666" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>

              {item.phone && (
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={14} color="#666" />
                  <Text style={styles.detailText}>{item.phone}</Text>
                </View>
              )}
            </View>

            <View style={styles.distanceContainer}>
              <Text style={styles.distanceText}>{formatDistance(item.distance ?? 0)}</Text>
              <Ionicons name="chevron-forward" size={20} color="#1A237E" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="hospital" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No hospitals found</Text>
            <Text style={styles.emptySubtext}>
              Try increasing the search radius or changing filters
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A237E',
    flex: 1,
    textAlign: 'center',
  },
  mapButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  suggestionText: {
    flex: 1,
    marginLeft: 10,
    color: '#334155',
    fontSize: 14,
    lineHeight: 19,
  },
  radiusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginRight: 12,
  },
  radiusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
  },
  radiusButtonActive: {
    backgroundColor: '#1A237E',
  },
  radiusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  radiusButtonTextActive: {
    color: '#fff',
  },
  filterContainer: {
    paddingVertical: 8,
    paddingLeft: 16,
    backgroundColor: '#fff',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  filterButtonActive: {
    backgroundColor: '#1A237E',
    borderColor: '#1A237E',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A237E',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  hospitalCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  hospitalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emergencyBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#d32f2f',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hospitalInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 6,
  },
  partnerBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginBottom: 4,
  },
  partnerBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  distanceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
