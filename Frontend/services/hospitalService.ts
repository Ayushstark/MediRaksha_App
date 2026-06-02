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
 * Resolve a Geoapify place_id → MongoDB hospital profile
 * Called in HospitalDetails.tsx on mount
 * Returns { isPartner: false } if hospital is not in our DB
 */
export async function getHospitalByPlaceId(
  placeId: string
): Promise<{ isPartner: boolean; hospital?: HospitalProfile }> {
  try {
    console.log('Calling API with placeId length:', placeId.length);
    console.log('Full URL:', `/hospitals/by-place/${placeId}`);
    const { data } = await apiClient.get(`/hospitals/by-place/${placeId}`);
    console.log('API response:', JSON.stringify(data));
    return data;
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
  return data;
}

/**
 * Cancel a booking by id
 * Decrements reservedBeds on backend automatically
 */
export async function cancelBedBooking(bookingId: string): Promise<void> {
  await apiClient.patch(`/bed-bookings/${bookingId}/cancel`);
}