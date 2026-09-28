import apiClient from '../apiClient';

export const MEDICONNECT_HOSPITAL_TYPES = [
  'MULTISPECIALITY',
  'GOVERNMENT',
  'PRIVATE',
  'TRAUMA_CENTER',
  'CARDIAC_CENTER',
  'CHILDREN_HOSPITAL',
] as const;

export const MEDICONNECT_FACILITY_TYPES = [
  'ICU',
  'VENTILATOR',
  'TRAUMA_CENTER',
  'CT_SCAN',
  'MRI',
  'BLOOD_BANK',
  'EMERGENCY_OT',
  'CARDIOLOGY',
  'NEUROLOGY',
  'ORTHOPEDICS',
  'PEDIATRICS',
  'MATERNITY',
  'DIALYSIS',
  'ONCOLOGY',
  'PHARMACY',
] as const;

export type MediConnectHospital = {
  id: string;
  hospitalCode?: string;
  name: string;
  type?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  rating?: number;
  reliabilityScore?: number;
  distanceKm?: number;
  isActive?: boolean;
  facilities?: any[];
  departments?: any[];
  contacts?: any[];
  insurance?: string[];
  specializations?: string[];
  description?: string;
};

const mapHospital = (row: any): MediConnectHospital => ({
  id: String(row?.id ?? row?._id ?? ''),
  hospitalCode: row?.hospital_code ?? row?.hospitalCode,
  name: row?.hospital_name ?? row?.name ?? 'Hospital',
  type: row?.hospital_type ?? row?.type,
  address: row?.address,
  city: row?.city,
  state: row?.state,
  country: row?.country,
  pincode: row?.pincode,
  latitude: row?.latitude == null ? undefined : Number(row.latitude),
  longitude: row?.longitude == null ? undefined : Number(row.longitude),
  phone: row?.phone,
  email: row?.email,
  rating: row?.rating == null ? undefined : Number(row.rating),
  reliabilityScore: row?.reliability_score == null ? undefined : Number(row.reliability_score),
  distanceKm: row?.distance_km == null ? undefined : Number(row.distance_km),
  isActive: row?.is_active,
  facilities: row?.facilities,
  departments: row?.departments,
  contacts: row?.contacts,
  insurance: Array.isArray(row?.insurance) ? row.insurance : [],
  specializations: Array.isArray(row?.specializations) ? row.specializations : [],
  description: row?.description,
});

export async function getMediConnectNearby(params: {
  latitude: number;
  longitude: number;
  radius?: number;
  hospitalType?: string;
  facilityType?: string;
  limit?: number;
}): Promise<MediConnectHospital[]> {
  const { data } = await apiClient.get('/hospitals/nearby', {
    params: {
      latitude: params.latitude,
      longitude: params.longitude,
      radius: params.radius ?? 10,
      hospital_type: params.hospitalType || undefined,
      facility_type: params.facilityType || undefined,
      limit: params.limit ?? 50,
    },
  });
  const rows = data?.data ?? data;
  return Array.isArray(rows) ? rows.map(mapHospital) : [];
}

export async function searchMediConnectHospitals(params: {
  city?: string;
  facility?: string;
  department?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<MediConnectHospital[]> {
  const { data } = await apiClient.get('/hospitals/search', {
    params: { ...params, page: params.page ?? 1, limit: params.limit ?? 50 },
  });
  const rows = data?.data ?? data;
  return Array.isArray(rows) ? rows.map(mapHospital) : [];
}

export async function getMediConnectHospital(id: string): Promise<MediConnectHospital> {
  const { data } = await apiClient.get(`/hospitals/${encodeURIComponent(id)}`);
  return mapHospital(data?.data ?? data);
}

export async function getMediConnectFacilities(id: string): Promise<any[]> {
  const { data } = await apiClient.get(`/hospitals/${encodeURIComponent(id)}/facilities`);
  const rows = data?.data ?? data;
  return Array.isArray(rows) ? rows : [];
}
