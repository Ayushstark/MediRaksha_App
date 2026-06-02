import React, { useEffect, useState } from 'react';
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
import { ROUTING_KEY } from "@/constants/geoapify";
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchRadius, setSearchRadius] = useState(5000); // 5km default

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
      const url =
        `https://api.geoapify.com/v2/places` +
        `?categories=healthcare.hospital` +
        `&filter=circle:${userLon},${userLat},${radius}` +
        `&limit=50` +
        `&apiKey=${ROUTING_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }

      const data = await response.json();

      const getSpecialtyFromName = (name: string) => {
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

      const hospitalsData: Hospital[] = (data.features || []).map(
        (item: any) => ({
          id: item.properties.place_id,
          name: item.properties.name || "Unnamed Hospital",
          latitude: item.properties.lat,
          longitude: item.properties.lon,
          speciality: getSpecialtyFromName(item.properties.name || ""),
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

      setHospitals(hospitalsWithDistance);
      setFilteredHospitals(hospitalsWithDistance);
    } catch (error) {
      console.error("Geoapify error:", error);
      Alert.alert(
        "Error",
        "Unable to fetch nearby hospitals. Please try again."
      );
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

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(h =>
        h.name.toLowerCase().includes(query) ||
        h.address.toLowerCase().includes(query) ||
        h.speciality.toLowerCase().includes(query)
      );
    }

    setFilteredHospitals(filtered);
  }, [selectedSpeciality, searchQuery, hospitals]);

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
          placeholder="Search hospitals by name, speciality..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

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