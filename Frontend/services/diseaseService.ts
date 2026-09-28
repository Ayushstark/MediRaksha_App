import API from '../apiClient';

export interface Disease {
  id: number;
  code?: number;
  name: string;
  common_name?: string;
  category: 'Infectious' | 'Chronic' | 'Genetic' | 'Lifestyle' | string;
  risk_level: 'Low' | 'Medium' | 'High' | string;
  transmission?: string;
  symtom?: string;
  solution?: string;
  description?: string;
  created_at?: string;
}

export async function fetchAllDiseases(): Promise<Disease[]> {
  try {
    const response = await API.get('/disease/all');
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Failed to load diseases:', error);
    return [];
  }
}

export async function fetchDiseaseById(id: number | string): Promise<Disease | null> {
  try {
    const response = await API.get(`/disease/${id}`);
    return response.data?.data ?? response.data ?? null;
  } catch (error) {
    console.warn('Failed to load disease details:', error);
    return null;
  }
}
