import apiClient from '../apiClient';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export type WardAvailability = {
  wardId: string;
  wardType: 'general' | 'icu' | 'emergency' | 'pediatric' | 'maternity';
  label: string;
  totalBeds: number;
  availableBeds: number;
};

export type HospitalProfile = {
  _id: string;
  name: string;
  geoapifyPlaceId: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  amenities: string[];
  isPartner: boolean;
  lastInventoryUpdate?: string;
};

export type HospitalAvailability = {
  hospitalId: string;
  hospitalName: string;
  lastInventoryUpdate?: string;
  amenities: string[];
  wards: WardAvailability[];
};

export type BedBookingPayload = {
  hospitalId: string;
  wardId: string;
  patientName: string;
  patientContact: string;
  reason: string;
  expectedArrival?: string;   // ISO date string
};

export type BedBooking = {
  _id: string;
  hospitalId: string;
  wardId: string;
  patientId: string;
  patientName: string;
  patientContact: string;
  reason: string;
  expectedArrival?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'checked_in';
  holdExpiresAt: string;
  createdAt: string;
  hospitalName?: string;      // joined from backend if available
  wardLabel?: string;
};

// ──────────────────────────────────────────────
// SERVICE FUNCTIONS
// ──────────────────────────────────────────────

/**
 * Resolve a Geoapify place_id to an Aiven PostgreSQL hospital profile
 * Called in HospitalDetails.tsx on mount
 * Returns { isPartner: false } if hospital is not in our DB
 */
export async function getHospitalByPlaceId(
  placeId: string
): Promise<{ isPartner: boolean; hospital?: HospitalProfile }> {
  try {
    const { data } = await apiClient.get(`/hospitals/by-place/${encodeURIComponent(placeId)}`);
    const hospital = data?.data;
    if (!hospital) return { isPartner: false };

    return {
      isPartner: true,
      hospital: {
        _id: String(hospital.id),
        name: hospital.name,
        geoapifyPlaceId: String(hospital.geoapifyPlaceId || hospital.place_id || hospital.id),
        address: hospital.address || hospital.name,
        latitude: Number(hospital.latitude || 0),
        longitude: Number(hospital.longitude || 0),
        phone: hospital.phone,
        amenities: Array.isArray(hospital.amenities) ? hospital.amenities : [],
        isPartner: hospital.isPartner !== false,
        lastInventoryUpdate: hospital.updatedAt,
      },
    };
  } catch (error: any) {
    console.log('API error status:', error?.response?.status);
    console.log('API error detail:', error?.response?.data);
    if (error?.response?.status === 404) {
      return { isPartner: false };
    }
    throw error;
  }
}

/**
 * Get ward availability for a partner hospital
 * Called after getHospitalByPlaceId confirms isPartner: true
 */
export async function getHospitalAvailability(
  hospitalId: string
): Promise<HospitalAvailability> {
  const { data } = await apiClient.get(`/hospitals/${hospitalId}/availability`);
  return data;
}

export async function registerPartnerHospitals(hospitals: any[]): Promise<any[]> {
  const { data } = await apiClient.post('/hospitals/register-partners', {
    hospitals: hospitals.map((hospital) => ({
      placeId: hospital.id,
      name: hospital.name,
      address: hospital.address,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      phone: hospital.phone,
      speciality: hospital.speciality,
      emergency: hospital.emergency,
    })),
  });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function seedNearbyPartnerHospitals(latitude: number, longitude: number): Promise<any[]> {
  const { data } = await apiClient.post('/hospitals/seed-nearby', { latitude, longitude });
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Book a bed — requires patient JWT (sent automatically by apiClient)
 * Returns the created booking doc
 */
export async function createBedBooking(
  payload: BedBookingPayload
): Promise<BedBooking> {
  const { data } = await apiClient.post('/bed-bookings', payload);
  return data;
}

/**
 * Get current patient's bookings
 * Used in MyBedBookings.tsx
 */
export async function getMyBedBookings(): Promise<BedBooking[]> {
  const { data } = await apiClient.get('/bed-bookings/my');
  return Array.isArray(data) ? data : [];
}

/**
 * Cancel a booking by id
 * Decrements reservedBeds on backend automatically
 */
export async function cancelBedBooking(bookingId: string): Promise<void> {
  await apiClient.patch(`/bed-bookings/${bookingId}/cancel`);
}
