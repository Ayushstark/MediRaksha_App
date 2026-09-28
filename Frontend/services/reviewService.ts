import API from '../apiClient';

export interface Review {
  id: number;
  entityType: 'hospital' | 'doctor' | 'platform';
  entityId: string | number;
  rating: number;
  reviewText?: string | null;
  authorName: string;
  userId?: number | null;
  created_at?: string;
}

export interface CreateReviewPayload {
  entityType: 'hospital' | 'doctor' | 'platform';
  entityId: string | number;
  rating: number;
  reviewText?: string;
  authorName?: string;
}

export async function fetchReviews(type: 'hospital' | 'doctor' | 'platform', entityId: string | number): Promise<Review[]> {
  try {
    const response = await API.get('/reviews', {
      params: { type, entityId: String(entityId) },
    });
    return Array.isArray(response.data?.data) ? response.data.data : [];
  } catch (error) {
    console.warn('Reviews fetch error:', error);
    return [];
  }
}

export async function submitReview(payload: CreateReviewPayload): Promise<Review | null> {
  try {
    const response = await API.post('/reviews', {
      ...payload,
      entityId: String(payload.entityId),
    });
    return response.data?.data ?? null;
  } catch (error: any) {
    console.error('Submit review error:', error);
    throw new Error(error.response?.data?.message || 'Failed to submit review');
  }
}
