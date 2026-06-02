import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<MapView>(null);

  const hospitals = params.hospitals ? JSON.parse(params.hospitals as string) : [];
  const userLocation = params.userLocation ? JSON.parse(params.userLocation as string) : null;

  useEffect(() => {

    // ADD THIS — temporary, remove after getting IDs
  hospitals.forEach((h: any) => {
    console.log("HOSPITAL:", h.name, "| ID:", h.id);
  });
  
    // Fit map to show all markers
    if (mapRef.current && hospitals.length > 0 && userLocation) {
      const coordinates = [
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        ...hospitals.map((h: any) => ({ latitude: h.latitude, longitude: h.longitude }))
      ];
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [hospitals, userLocation]);

  const handleHospitalPress = (hospital: any) => {
    router.push({
      pathname: '/HospitalDetails',
      params: {
        hospital: JSON.stringify(hospital),
        userLocation: JSON.stringify(userLocation)
      }
    });
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  if (!userLocation) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Location not available</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Map View</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {/* User Location Marker */}
        <Marker
          coordinate={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude
          }}
          title="Your Location"
        >
          <View style={styles.userMarker}>
            <Ionicons name="person" size={24} color="#1A237E" />
          </View>
        </Marker>

        {/* Hospital Markers */}
        {hospitals.map((hospital: any) => (
          <Marker
            key={hospital.id}
            coordinate={{
              latitude: hospital.latitude,
              longitude: hospital.longitude
            }}
            onPress={() => handleHospitalPress(hospital)}
          >
            <View style={styles.hospitalMarker}>
              <FontAwesome5 name="hospital" size={20} color="#d32f2f" />
              {hospital.emergency && (
                <View style={styles.emergencyDot} />
              )}
            </View>
            
            <Callout
              tooltip
              onPress={() => handleHospitalPress(hospital)}
            >
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle} numberOfLines={1}>
                  {hospital.name}
                </Text>
                <Text style={styles.calloutSubtitle}>
                  {hospital.speciality}
                </Text>
                <View style={styles.calloutFooter}>
                  <Ionicons name="navigate" size={12} color="#666" />
                  <Text style={styles.calloutDistance}>
                    {formatDistance(hospital.distance)}
                  </Text>
                </View>
                <Text style={styles.calloutTap}>Tap for details →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Bottom Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <FontAwesome5 name="hospital" size={16} color="#1A237E" />
            <Text style={styles.infoText}>{hospitals.length} Hospitals</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location" size={16} color="#d32f2f" />
            <Text style={styles.infoText}>Your Location</Text>
          </View>
        </View>
        <Text style={styles.infoHint}>Tap on markers to view hospital details</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#1A237E' }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#d32f2f' }]} />
          <Text style={styles.legendText}>Hospital</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ff9800' }]} />
          <Text style={styles.legendText}>Emergency</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#1A237E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
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
  map: {
    flex: 1,
  },
  userMarker: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#1A237E',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  hospitalMarker: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#d32f2f',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emergencyDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff9800',
    borderWidth: 2,
    borderColor: '#fff',
  },
  calloutContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  calloutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutDistance: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  calloutTap: {
    fontSize: 11,
    color: '#1A237E',
    fontWeight: '600',
    textAlign: 'right',
  },
  infoCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  infoHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  legend: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
});