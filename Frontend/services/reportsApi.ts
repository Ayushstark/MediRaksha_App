import { Platform } from 'react-native';
import API from '../apiClient';

export type ReportVisibility = 'private' | 'doctor' | 'shared' | 'emergency';
export type ReportCategory = 'lab' | 'prescription' | 'scan' | 'discharge' | 'other';
export type PreviewType = 'image' | 'pdf' | 'other';

export type LinkedDoctor = {
  id: string | number;
  name: string;
  speciality?: string;
  specialization?: string;
};

export type MedicalReport = {
  id: string;
  _id: string;
  userId?: string;
  uploadedBy?: string;
  doctorId?: string | number | null;
  title: string;
  category: ReportCategory | string;
  fileSize: number;
  mimeType?: string;
  visibility: ReportVisibility | string;
  originalFileName: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  fileData?: string;
  recordId?: string | number;
  doctorName?: string;
  specialization?: string;
  hospital?: string;
  visitDate?: string;
  notes?: string;
  isImportant?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  tags?: Array<{ id?: number; name: string; color?: string }>;
  collections?: Array<{ id: number; name: string }>;
};

export type PatientHealthSummary = {
  bloodGroup?: string | null;
  knownConditions?: string | null;
  allergies?: string | null;
  emergencyContact?: string | null;
  healthRemarks?: string | null;
};

export type ReportCollection = {
  id: number;
  name: string;
  description?: string | null;
  recordCount?: number;
  prescriptionCount?: number;
  labCount?: number;
  scanCount?: number;
  importantCount?: number;
  recentRecords?: MedicalReport[];
};

export type RecordTag = {
  id: number;
  name: string;
  color: string;
  usageCount?: number;
};

export const MAX_REPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_REPORT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const REPORT_CATEGORIES: Array<{ value: ReportCategory; label: string; prefix: string }> = [
  { value: 'prescription', label: 'Prescription', prefix: 'PRES' },
  { value: 'lab', label: 'Lab Report', prefix: 'LAB' },
  { value: 'scan', label: 'Scan (MRI, X-Ray)', prefix: 'IMG' },
  { value: 'discharge', label: 'Discharge Summary', prefix: 'DIS' },
  { value: 'other', label: 'Other', prefix: 'REC' },
];

export const normalizeReport = (report: any): MedicalReport => ({
  ...report,
  id: String(report.id ?? report._id ?? ''),
  _id: String(report.id ?? report._id ?? ''),
  title: report.title || report.originalFileName || 'Medical Record',
  category: report.category || 'other',
  fileSize: Number(report.fileSize || 0),
  visibility: report.visibility || 'private',
  originalFileName: report.originalFileName || report.title || 'Medical Record',
  createdAt: report.created_at || report.createdAt,
  updatedAt: report.updated_at || report.updatedAt,
  recordId: report.recordId ?? report.record_id,
  doctorName: report.doctorName ?? report.doctor_name,
  specialization: report.specialization,
  hospital: report.hospital,
  visitDate: report.visitDate ?? report.visit_date,
  notes: report.notes,
  isImportant: Boolean(report.isImportant ?? report.is_important),
  isArchived: Boolean(report.isArchived ?? report.is_archived),
  isPinned: Boolean(report.isPinned ?? report.is_pinned),
  tags: Array.isArray(report.tags) ? report.tags : [],
  collections: Array.isArray(report.collections) ? report.collections : [],
});

export const getPreviewType = (mimeType?: string, originalFileName = ''): PreviewType => {
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(originalFileName)) return 'pdf';
  if (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(originalFileName)) return 'image';
  return 'other';
};

export const getReportDataUri = (report: MedicalReport) =>
  `data:${report.mimeType || 'application/octet-stream'};base64,${report.fileData}`;

export async function getPatientReports() {
  try {
    const response = await API.get('/user/records/all');
    const rows = response.data?.data ?? [];
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map(normalizeReport);
    }
  } catch (err) {
    // fallback to legacy endpoint
  }

  const response = await API.get('/user/report/all');
  const rows = response.data?.data ?? [];
  return Array.isArray(rows) ? rows.map(normalizeReport) : [];
}

export async function getPatientReportById(id: string) {
  try {
    const response = await API.get(`/user/records/${id}`);
    if (response.data?.data) return normalizeReport(response.data.data);
  } catch (err) {
    // fallback
  }

  const response = await API.get(`/user/report/${id}`);
  return normalizeReport(response.data?.data ?? response.data);
}

export async function getAssignedDoctor(): Promise<LinkedDoctor | null> {
  try {
    const response = await API.get('/user/doctor/my');
    if (response.data?.success === false) return null;
    return response.data?.data ?? response.data ?? null;
  } catch {
    return null;
  }
}

export async function uploadPatientReport(payload: {
  file: any;
  title: string;
  category: ReportCategory;
  visibility: ReportVisibility;
  doctorId?: string | number;
  doctorName?: string;
  hospital?: string;
  notes?: string;
  tags?: string[];
}) {
  const formData = new FormData();
  formData.append('file', {
    uri: Platform.OS === 'ios' ? payload.file.uri.replace('file://', '') : payload.file.uri,
    name: payload.file.name || `record_${Date.now()}.pdf`,
    type: payload.file.mimeType || 'application/pdf',
  } as any);
  formData.append('title', payload.title.trim());
  formData.append('category', payload.category);
  formData.append('visibility', payload.visibility);
  if (payload.doctorName) formData.append('doctorName', payload.doctorName);
  if (payload.hospital) formData.append('hospital', payload.hospital);
  if (payload.notes) formData.append('notes', payload.notes);
  if (payload.tags && payload.tags.length > 0) formData.append('tags', payload.tags.join(','));
  if (payload.visibility === 'doctor' && payload.doctorId) {
    formData.append('doctorId', String(payload.doctorId));
  }

  // Use create record if supported, else legacy upload
  try {
    const response = await API.post('/user/records/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeReport(response.data?.data ?? response.data);
  } catch (err) {
    const response = await API.post('/user/report/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeReport(response.data?.data ?? response.data);
  }
}

export async function deletePatientReport(id: string) {
  try {
    const response = await API.delete(`/user/records/${id}`);
    return response.data;
  } catch {
    const response = await API.delete(`/user/report/${id}`);
    return response.data;
  }
}

export async function togglePinReport(id: string) {
  const response = await API.patch(`/user/records/${id}/pin`);
  return response.data;
}

export async function toggleImportantReport(id: string) {
  const response = await API.patch(`/user/records/${id}/important`);
  return response.data;
}

export async function toggleArchiveReport(id: string) {
  const response = await API.patch(`/user/records/${id}/archive`);
  return response.data;
}

export async function getDoctorSharedReports() {
  const response = await API.get('/doctor/userreport');
  const rows = response.data?.data ?? response.data ?? [];
  return Array.isArray(rows) ? rows.map(normalizeReport) : [];
}

export async function getReportWorkspace(): Promise<{
  reports: MedicalReport[];
  summary: PatientHealthSummary | null;
  collections: ReportCollection[];
}> {
  const [recordsResult, summaryResult, collectionsResult] = await Promise.allSettled([
    API.get('/user/records/all'),
    API.get('/user/records/summary'),
    API.get('/user/collections'),
  ]);

  const recordsData = recordsResult.status === 'fulfilled' ? recordsResult.value.data : null;
  const summaryData = summaryResult.status === 'fulfilled' ? summaryResult.value.data : null;
  const collectionsData = collectionsResult.status === 'fulfilled' ? collectionsResult.value.data : null;

  return {
    reports: Array.isArray(recordsData?.data) ? recordsData.data.map(normalizeReport) : [],
    summary: summaryData?.success === false ? null : (summaryData?.data ?? summaryData ?? null),
    collections: Array.isArray(collectionsData?.data)
      ? collectionsData.data.map((item: any) => ({ ...item, recentRecords: Array.isArray(item.recentRecords) ? item.recentRecords.map(normalizeReport) : [] }))
      : [],
  };
}

export async function savePatientHealthSummary(summary: PatientHealthSummary) {
  const response = await API.post('/user/records/summary', summary);
  return response.data?.data ?? response.data;
}

export async function createReportCollection(name: string, description?: string) {
  const response = await API.post('/user/collections', { name, description: description || null });
  return response.data?.data ?? response.data;
}

export async function addRecordToCollection(collectionId: number, recordId: string) {
  const response = await API.post(`/user/collections/${collectionId}/records/${recordId}`);
  return response.data;
}

export async function removeRecordFromCollection(collectionId: number, recordId: string) {
  const response = await API.delete(`/user/collections/${collectionId}/records/${recordId}`);
  return response.data;
}

export async function getUserTags(): Promise<RecordTag[]> {
  try {
    const response = await API.get('/user/tags');
    return Array.isArray(response.data?.data) ? response.data.data : [];
  } catch {
    return [];
  }
}

export async function createTag(name: string, color?: string): Promise<RecordTag | null> {
  const response = await API.post('/user/tags', { name, color });
  return response.data?.data ?? null;
}
