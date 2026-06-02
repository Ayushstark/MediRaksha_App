import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  getHospitalByPlaceId,
  getHospitalAvailability,
  HospitalProfile,
  HospitalAvailability,
} from '../services/hospitalService';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ROUTING_KEY } from "@/constants/geoapify";
import { getDoctorsForHospital, Doctor } from '../services/doctorService';

export default function HospitalDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const hospital = params.hospital ? JSON.parse(params.hospital as string) : null;
  const userLocation = params.userLocation ? JSON.parse(params.userLocation as string) : null;



  const [showDirections, setShowDirections] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [partnerHospital, setPartnerHospital] = useState<HospitalProfile | null>(null);
  const [availability, setAvailability] = useState<HospitalAvailability | null>(null);
  const [loadingBeds, setLoadingBeds] = useState(true);
  console.log('=== HospitalDetails mounted ===');
  console.log('hospital object:', JSON.stringify(hospital));
  console.log('hospital.id:', hospital?.id);
  console.log('hospital.place_id:', hospital?.place_id);
  console.log('hospital keys:', hospital ? Object.keys(hospital) : 'null');

  useEffect(() => {
    const fetchPartnerStatus = async () => {
      try {
        setLoadingBeds(true);

        // Log everything to find the exact field
        console.log('Full hospital object:', JSON.stringify(hospital));
        console.log('hospital.id:', hospital?.id);

        const placeId = hospital?.id || hospital?.place_id || hospital?.properties?.place_id;
        console.log('placeId being used:', placeId);

        if (!placeId) {
          console.log('No placeId found — skipping partner check');
          setLoadingBeds(false);
          return;
        }

        const result = await getHospitalByPlaceId(placeId);
        console.log('Partner result:', JSON.stringify(result));

        if (result.isPartner && result.hospital) {
          setIsPartner(true);
          setPartnerHospital(result.hospital);
          const avail = await getHospitalAvailability(result.hospital._id);
          console.log('Availability:', JSON.stringify(avail));
          setAvailability(avail);
        }
      } catch (error) {
        console.log('Partner check error:', error);
      } finally {
        setLoadingBeds(false);
      }
    };

    fetchPartnerStatus();
  }, []);

  if (!hospital || !userLocation) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Hospital details not available</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const estimateTravelTime = (meters: number) => {
    // Assuming average speed of 30 km/h in city
    const hours = meters / 1000 / 30;
    const minutes = Math.round(hours * 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const handleCall = () => {
    if (hospital.phone) {
      const phoneNumber = hospital.phone.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('No Phone Number', 'Phone number not available for this hospital');
    }
  };

  const handleGetDirections = () => {
    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:'
    });
    const url = Platform.select({
      ios: `${scheme}?daddr=${hospital.latitude},${hospital.longitude}`,
      android: `${scheme}${hospital.latitude},${hospital.longitude}?q=${hospital.latitude},${hospital.longitude}(${hospital.name})`
    });

    Linking.openURL(url!).catch(() => {
      Alert.alert('Error', 'Unable to open maps application');
    });
  };

  const handleShareLocation = () => {
    const message = `Check out ${hospital.name}\nSpeciality: ${hospital.speciality}\nLocation: https://maps.google.com/?q=${hospital.latitude},${hospital.longitude}`;

    // You can integrate share functionality here
    Alert.alert('Share', message);
  };

  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Call',
      'Call emergency services?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 108',
          onPress: () => Linking.openURL('tel:108')
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Hospital Details</Text>
        <TouchableOpacity onPress={handleShareLocation} style={styles.shareButton}>
          <Ionicons name="share-social" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Map Preview */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: hospital.latitude,
              longitude: hospital.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={{
                latitude: hospital.latitude,
                longitude: hospital.longitude
              }}
              title={hospital.name}
            >
              <View style={styles.customMarker}>
                <FontAwesome5 name="hospital" size={24} color="#d32f2f" />
              </View>
            </Marker>

            <Marker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
              }}
              title="Your Location"
            >
              <View style={styles.userMarker}>
                <Ionicons name="person" size={20} color="#1A237E" />
              </View>
            </Marker>

            {showDirections && (
              <Polyline
                coordinates={[
                  { latitude: userLocation.latitude, longitude: userLocation.longitude },
                  { latitude: hospital.latitude, longitude: hospital.longitude }
                ]}
                strokeColor="#1A237E"
                strokeWidth={3}
              />
            )}
          </MapView>

          <TouchableOpacity
            style={styles.directionsToggle}
            onPress={() => setShowDirections(!showDirections)}
          >
            <MaterialIcons
              name={showDirections ? "clear" : "directions"}
              size={20}
              color="#1A237E"
            />
            <Text style={styles.directionsToggleText}>
              {showDirections ? 'Hide Route' : 'Show Route'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hospital Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <View style={styles.iconBadge}>
              <FontAwesome5 name="hospital" size={28} color="#1A237E" />
            </View>
            <View style={styles.titleInfo}>
              <Text style={styles.hospitalName}>{hospital.name}</Text>
              <View style={styles.specialityBadge}>
                <Text style={styles.specialityText}>{hospital.speciality}</Text>
              </View>
            </View>
          </View>

          {hospital.emergency && (
            <View style={styles.emergencyBanner}>
              <MaterialIcons name="emergency" size={20} color="#fff" />
              <Text style={styles.emergencyText}>24/7 Emergency Services Available</Text>
            </View>
          )}

          {/* Details Section */}
          <View style={styles.detailsSection}>
            <DetailItem
              icon={<Ionicons name="location" size={20} color="#1A237E" />}
              label="Address"
              value={hospital.address}
            />

            {hospital.phone && (
              <DetailItem
                icon={<Ionicons name="call" size={20} color="#1A237E" />}
                label="Phone"
                value={hospital.phone}
                onPress={handleCall}
                actionIcon={<Ionicons name="call" size={16} color="#fff" />}
              />
            )}

            <DetailItem
              icon={<MaterialIcons name="near-me" size={20} color="#1A237E" />}
              label="Distance"
              value={formatDistance(hospital.distance)}
            />

            <DetailItem
              icon={<Ionicons name="time" size={20} color="#1A237E" />}
              label="Est. Travel Time"
              value={estimateTravelTime(hospital.distance)}
            />

            <DetailItem
              icon={<Ionicons name="navigate" size={20} color="#1A237E" />}
              label="Coordinates"
              value={`${hospital.latitude.toFixed(6)}, ${hospital.longitude.toFixed(6)}`}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction]}
            onPress={handleGetDirections}
          >
            <MaterialIcons name="directions" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Get Directions</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>

          {hospital.phone && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryAction]}
              onPress={handleCall}
            >
              <Ionicons name="call" size={24} color="#1A237E" />
              <Text style={[styles.actionButtonText, styles.secondaryActionText]}>
                Call Hospital
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#1A237E" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.emergencyAction]}
            onPress={handleEmergencyCall}
          >
            <MaterialIcons name="emergency" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Emergency Call 108</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Specialists Section */}
        <View style={styles.specialistsCard}>
          <Text style={styles.actionsTitle}>Specialists at this Hospital</Text>
          {getDoctorsForHospital(hospital.name, hospital.speciality || 'General').map((dr) => (
            <TouchableOpacity
              key={dr.id}
              style={styles.doctorItem}
              onPress={() => router.push({
                pathname: '/DoctorDetails',
                params: dr as any
              })}
            >
              <View style={styles.drIcon}>
                <FontAwesome5 name="user-md" size={20} color="#1A237E" />
              </View>
              <View style={styles.drInfo}>
                <Text style={styles.drName}>{dr.name}</Text>
                <Text style={styles.drDegree}>{dr.degree}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Bed Availability Section */}
        {loadingBeds ? (
          <View style={styles.bedCard}>
            <ActivityIndicator size="small" color="#1A237E" />
            <Text style={styles.bedLoadingText}>Checking bed availability...</Text>
          </View>
        ) : !isPartner ? (
          <View style={styles.bedCard}>
            <View style={styles.bedCardHeader}>
              <FontAwesome5 name="bed" size={18} color="#666" />
              <Text style={styles.bedCardTitle}>Bed Booking</Text>
            </View>
            <Text style={styles.notPartnerText}>
              Bed booking is not available for this hospital yet.
            </Text>
          </View>
        ) : (
          <View style={styles.bedCard}>
            {/* Header */}
            <View style={styles.bedCardHeader}>
              <FontAwesome5 name="bed" size={18} color="#1A237E" />
              <Text style={styles.bedCardTitle}>Bed Availability</Text>
              {availability?.lastInventoryUpdate && (
                <Text style={styles.lastUpdated}>
                  Updated {new Date(availability.lastInventoryUpdate).toLocaleDateString()}
                </Text>
              )}
            </View>

            {/* Amenity Chips */}
            {availability?.amenities && availability.amenities.length > 0 && (
              <View style={styles.chipsRow}>
                {availability.amenities.map((a) => (
                  <View key={a} style={styles.chip}>
                    <Text style={styles.chipText}>{a.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Ward Cards */}
            {availability?.wards.map((ward) => (
              <View key={ward.wardId} style={styles.wardRow}>
                <View style={styles.wardInfo}>
                  <Text style={styles.wardLabel}>{ward.label}</Text>
                  <Text style={styles.wardTotal}>{ward.totalBeds} total beds</Text>
                </View>
                <View style={[
                  styles.wardBadge,
                  ward.availableBeds === 0 ? styles.wardFull : styles.wardAvailable
                ]}>
                  <Text style={styles.wardBadgeText}>
                    {ward.availableBeds === 0 ? 'Full' : `${ward.availableBeds} free`}
                  </Text>
                </View>
              </View>
            ))}

            {/* Book Button */}
            <TouchableOpacity
              style={styles.bookBedButton}
              onPress={() => router.push({
                pathname: '/BookBed',
                params: {
                  hospitalId: partnerHospital?._id,
                  hospitalName: partnerHospital?.name,
                  wards: JSON.stringify(availability?.wards),
                }
              })}
            >
              <FontAwesome5 name="bed" size={18} color="#fff" />
              <Text style={styles.bookBedButtonText}>Book a Bed</Text>
            </TouchableOpacity>

            {/* Disclaimer */}
            <Text style={styles.bedDisclaimer}>
              ⚠️ Availability is an estimate and not a guaranteed admission.
            </Text>
          </View>
        )}

        {/* Additional Info */}
        <View style={styles.infoNote}>
          <Feather name="info" size={16} color="#666" />
          <Text style={styles.infoNoteText}>
            Please verify hospital details before visiting. Information is augmented with specialist profiles.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const DetailItem = ({ icon, label, value, onPress, actionIcon }: any) => (
  <View style={styles.detailItem}>
    <View style={styles.detailIcon}>{icon}</View>
    <View style={styles.detailContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
    {onPress && (
      <TouchableOpacity style={styles.detailAction} onPress={onPress}>
        {actionIcon}
      </TouchableOpacity>
    )}
  </View>
);

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
    backgroundColor: '#1A237E',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    height: 300,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  customMarker: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#d32f2f',
  },
  userMarker: {
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1A237E',
  },
  directionsToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  directionsToggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A237E',
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: -40,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  titleRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  titleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  hospitalName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 8,
  },
  specialityBadge: {
    backgroundColor: '#e8f5e9',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A237E',
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d32f2f',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  emergencyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailsSection: {
    marginTop: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  detailAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A237E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryAction: {
    backgroundColor: '#1A237E',
  },
  secondaryAction: {
    backgroundColor: '#e8f5e9',
  },
  emergencyAction: {
    backgroundColor: '#d32f2f',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  secondaryActionText: {
    color: '#1A237E',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1A237E',
  },

  bedCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bedCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A237E',
    marginLeft: 10,
    flex: 1,
  },
  lastUpdated: {
    fontSize: 11,
    color: '#999',
  },
  bedLoadingText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
    fontSize: 14,
  },
  notPartnerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: '#E8EAF6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A237E',
  },
  wardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  wardInfo: {
    flex: 1,
  },
  wardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  wardTotal: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  wardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  wardAvailable: {
    backgroundColor: '#e8f5e9',
  },
  wardFull: {
    backgroundColor: '#ffebee',
  },
  wardBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  bookBedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A237E',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 10,
  },
  bookBedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bedDisclaimer: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },

  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 12,
    lineHeight: 18,
  },
  specialistsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
  },
  doctorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  drIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8EAF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  drInfo: { flex: 1 },
  drName: { fontSize: 16, fontWeight: 'bold', color: '#1A237E' },
  drDegree: { fontSize: 12, color: '#4CAF50' },
});