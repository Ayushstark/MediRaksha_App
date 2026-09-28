import apiClient from '../apiClient';

export type EmergencyResponse = {
  emergency_id: string;
  status: string;
  emergency_token: string;
  token_expires_at: string;
  qr_payload: string;
  family_notifications_queued: number;
  created_at: string;
};

export async function createEmergency(payload: {
  latitude: number;
  longitude: number;
  location_accuracy?: number;
}): Promise<EmergencyResponse> {
  const { data } = await apiClient.post('/emergency/create', payload);
  return data?.data ?? data;
}
