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
    const { data } = await apiClient.get(`/hospital/geoapify/place/${encodeURIComponent(placeId)}`);
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
  try {
    const { data } = await apiClient.get(`/hospital/${hospitalId}`);
    const hospital = data?.data ?? data;

    // The live backend returns a flat hospital row with a 'bed' integer field.
    // We adapt it into the ward-based shape that BookBed.tsx expects.
    const availableBeds = Number(hospital?.bed ?? 0);
    const ward: WardAvailability = {
      wardId: `${hospitalId}-general`,
      wardType: 'general',
      label: 'General Ward',
      totalBeds: availableBeds,
      availableBeds,
    };

    return {
      hospitalId: String(hospital?.id ?? hospitalId),
      hospitalName: hospital?.name ?? 'Hospital',
      lastInventoryUpdate: hospital?.updated_at,
      amenities: Array.isArray(hospital?.amenities) ? hospital.amenities : [],
      wards: availableBeds > 0 ? [ward] : [],
    };
  } catch {
    // Return a safe empty availability so BookBed.tsx can show "No wards configured"
    return {
      hospitalId,
      hospitalName: 'Hospital',
      amenities: [],
      wards: [],
    };
  }
}

export async function registerPartnerHospitals(hospitals: any[]): Promise<any[]> {
  const { data } = await apiClient.post('/hospital/register-partners', {
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
  }).catch(() => ({ data: { data: [] } }));
  return Array.isArray(data?.data) ? data.data : [];
}

export async function seedNearbyPartnerHospitals(latitude: number, longitude: number): Promise<any[]> {
  const { data } = await apiClient.post('/hospital/seed-nearby', { latitude, longitude }).catch(() => ({ data: { data: [] } }));
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Book a bed — requires patient JWT (sent automatically by apiClient)
 * Returns the created booking doc
 */
export async function createBedBooking(
  payload: BedBookingPayload
): Promise<BedBooking> {
  // The live backend expects: bedsRequested, contactName, contactNumber, notes, hospitalName
  // It does NOT have wardId/reason/expectedArrival in its schema.
  const { data } = await apiClient.post(`/hospital/${payload.hospitalId}/bed-bookings`, {
    bedsRequested: 1,
    contactName: payload.patientName,
    contactNumber: payload.patientContact,
    notes: `Ward: ${payload.wardId} | Reason: ${payload.reason}${payload.expectedArrival ? ` | Expected: ${payload.expectedArrival}` : ''}`,
    hospitalName: undefined, // backend resolves name from DB
  });

  // Map the backend response into our BedBooking shape
  const row = data?.data ?? data;
  return {
    _id: String(row?.id ?? ''),
    hospitalId: String(row?.hospitalId ?? payload.hospitalId),
    wardId: payload.wardId,
    patientId: String(row?.userId ?? ''),
    patientName: row?.contactName ?? payload.patientName,
    patientContact: row?.contactNumber ?? payload.patientContact,
    reason: payload.reason,
    expectedArrival: payload.expectedArrival,
    status: row?.status === 'active' ? 'confirmed' : (row?.status ?? 'confirmed'),
    holdExpiresAt: row?.updated_at ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    createdAt: row?.created_at ?? new Date().toISOString(),
    hospitalName: row?.hospitalName,
  };
}

/**
 * Get current patient's bookings
 * Used in MyBedBookings.tsx
 */
export async function getMyBedBookings(): Promise<BedBooking[]> {
  const { data } = await apiClient.get('/hospital/bed-bookings/my');
  return Array.isArray(data) ? data : [];
}

/**
 * Cancel a booking by id
 * Decrements reservedBeds on backend automatically
 */
export async function cancelBedBooking(bookingId: string): Promise<void> {
  await apiClient.delete(`/hospital/bed-bookings/${bookingId}`);
}
