import API from '../apiClient';
import { findCanonicalSpecialization } from '../constants/specializations';

export const toDateString = (value: Date) => {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
};

export const normalizeTime = (value: any) => {
  const str = String(value ?? '').trim();
  return parseTo24Hour(str);
};

export const parseTo24Hour = (timeStr: any): string => {
  const str = String(timeStr ?? '').trim();
  if (!str) return '09:00';
  const cleanStr = str.includes('-') ? str.split('-')[0].trim() : str;
  const match12 = cleanStr.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  const match24 = cleanStr.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (match24) {
    const hours = parseInt(match24[1], 10).toString().padStart(2, '0');
    return `${hours}:${match24[2]}`;
  }
  return cleanStr.slice(0, 5);
};

export const formatTime12Hour = (timeStr: any): string => {
  const str = String(timeStr ?? '').trim();
  if (!str) return '';
  if (str.includes('-')) {
    const parts = str.split('-').map(p => formatTime12Hour(p.trim()));
    return parts.join(' - ');
  }
  const match12 = str.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (match12) {
    const hours = parseInt(match12[1], 10).toString().padStart(2, '0');
    return `${hours}:${match12[2]} ${match12[3].toUpperCase()}`;
  }
  const match24 = str.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const minutes = match24[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return str;
};

export const formatSlotDateBadge = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const cleanDate = String(dateStr).slice(0, 10);
  const today = toDateString(new Date());

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = toDateString(tomorrowDate);

  if (cleanDate === today) return 'Today';
  if (cleanDate === tomorrowStr) return 'Tomorrow';

  const d = new Date(`${cleanDate}T00:00:00`);
  if (isNaN(d.getTime())) return cleanDate;

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
};

export const formatSlotDateFull = (dateInput?: Date | string | null): string => {
  if (!dateInput) return '';
  const dateObj = typeof dateInput === 'string' ? new Date(`${dateInput.slice(0, 10)}T00:00:00`) : dateInput;
  if (!dateObj || isNaN(dateObj.getTime())) return String(dateInput);
  return dateObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatAppointmentDateTime = (appointment: any) => {
  const date = String(appointment.appointmentDate ?? appointment.date ?? '').slice(0, 10);
  const rawTime = appointment.slotTime ?? appointment.startTime ?? appointment.time;
  if (!date && !rawTime) return 'Date/time not set';
  const formattedTime = formatTime12Hour(rawTime);
  const dateLabel = date ? formatSlotDateFull(date) : 'Date not set';
  return formattedTime ? `${dateLabel} at ${formattedTime}` : dateLabel;
};

export const normalizeSpeciality = (value: any) => {
  const text = String(value || '').trim();
  if (!text) return 'General Physician';
  const canonical = findCanonicalSpecialization(text);
  if (canonical) return canonical;
  const normalized = text.toLowerCase();
  if (normalized === 'general' || normalized === 'general medicine') return 'General Physician';
  if (normalized === 'cardiology' || normalized === 'cardiologist') return 'Cardiologist';
  if (normalized === 'neurology' || normalized === 'neurologist') return 'Neurologist';
  if (normalized === 'orthopedics' || normalized === 'orthopedic') return 'Orthopedic Surgeon';
  if (normalized === 'pediatrics' || normalized === 'pediatrician') return 'Pediatrician';
  if (normalized === 'dermatology' || normalized === 'dermatologist') return 'Dermatologist';
  return text;
};

export const isSlotPassed = (dateStr?: string | null, timeStr?: string | null): boolean => {
  if (!dateStr || !timeStr) return false;
  const todayStr = toDateString(new Date());
  const cleanDate = String(dateStr).slice(0, 10);
  if (cleanDate < todayStr) return true;
  if (cleanDate > todayStr) return false;

  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  const time24 = parseTo24Hour(timeStr);
  const [slotHours, slotMinutes] = time24.split(':').map(Number);
  if (isNaN(slotHours) || isNaN(slotMinutes)) return false;
  const slotTotalMinutes = slotHours * 60 + slotMinutes;

  return slotTotalMinutes <= currentTotalMinutes;
};

export const filterUpcomingSlots = (slots: any[]): any[] => {
  if (!Array.isArray(slots)) return [];
  return slots.filter((slot: any) => {
    if (!slot) return false;
    if (slot.status === 'booked') return false;
    const date = slot.bookingDate || slot.date;
    const time = slot.slotTime || slot.time;
    return !isSlotPassed(date, time);
  });
};

export const normalizeDoctor = (doctor: any) => ({
  ...doctor,
  _id: String(doctor.id ?? doctor._id ?? ''),
  id: String(doctor.id ?? doctor._id ?? ''),
  doctorId: String(doctor.id ?? doctor._id ?? ''),
  specialization: normalizeSpeciality(doctor.speciality ?? doctor.specialization),
  specialty: normalizeSpeciality(doctor.speciality ?? doctor.specialization),
  latitude: doctor.latitude !== undefined && doctor.latitude !== null ? Number(doctor.latitude) : undefined,
  longitude: doctor.longitude !== undefined && doctor.longitude !== null ? Number(doctor.longitude) : undefined,
  distance: doctor.distance !== undefined && doctor.distance !== null ? Number(doctor.distance) : undefined,
  address: doctor.address || doctor.hospitalAddress,
  experience: doctor.experience ? Number(doctor.experience) : 8,
  rating: doctor.rating ? Number(doctor.rating) : 4.8,
  availableSlots: Array.isArray(doctor.availableSlots)
    ? filterUpcomingSlots(doctor.availableSlots.map(normalizeSlot))
    : Array.isArray(doctor.slots)
      ? filterUpcomingSlots(doctor.slots.map(normalizeSlot))
      : [],
});

export const normalizePatient = (patient: any) => ({
  ...patient,
  _id: String(patient.id ?? patient._id ?? ''),
  phoneNumber: patient.number ?? patient.phoneNumber,
  appointments: patient.appointmentHistory ?? patient.appointments ?? [],
});

export const normalizeAppointment = (appointment: any) => ({
  ...appointment,
  _id: String(appointment.Id ?? appointment.id ?? appointment._id ?? ''),
  id: String(appointment.Id ?? appointment.id ?? appointment._id ?? ''),
  appointmentDate: String(appointment.appointmentDate ?? appointment.date ?? '').slice(0, 10),
  date: String(appointment.appointmentDate ?? appointment.date ?? '').slice(0, 10),
  slotTime: normalizeTime(appointment.slotTime ?? appointment.startTime ?? appointment.time),
  startTime: normalizeTime(appointment.slotTime ?? appointment.startTime ?? appointment.time),
  reason: appointment.reasonOfAppointment,
  status: appointment.status === 'approved' ? 'confirmed' : appointment.status,
  patient: appointment.patient ?? {
    id: appointment.patientId ? String(appointment.patientId) : undefined,
    name: appointment.patientName,
    age: appointment.patientAge,
    gender: appointment.patientGender,
    email: appointment.patientEmail,
    phoneNumber: appointment.patientContact,
  },
});

export const normalizeSlot = (slot: any) => {
  if (!slot || typeof slot !== 'object') return null;
  const rawDate = String(slot.bookingDate ?? slot.date ?? '').slice(0, 10);
  const rawTime = String(slot.slotTime ?? slot.time ?? '').trim();
  const time24 = parseTo24Hour(rawTime);
  const displayTime = formatTime12Hour(rawTime || time24);
  return {
    ...slot,
    _id: String(slot.id ?? slot._id ?? ''),
    id: String(slot.id ?? slot._id ?? ''),
    bookingDate: rawDate,
    date: rawDate,
    slotTime: time24,
    time: time24,
    displayTime,
  };
};

export async function getCurrentProfile(role?: string) {
  const isDoctor = role === 'Doctor';
  const response = await API.get(isDoctor ? '/doctor/info/detail' : '/user/info/detail');
  const data = response.data?.data ?? response.data;
  return isDoctor
    ? { ...normalizeDoctor(data), role: 'Doctor' }
    : { ...normalizePatient(data), role: 'Patient' };
}

export async function getDoctors(params?: {
  latitude?: number;
  longitude?: number;
  radius?: number;
  specialty?: string;
  search?: string;
  nearby?: boolean;
}) {
  const byId = new Map<string, any>();
  const addDoctors = (items: any) => {
    const doctors = Array.isArray(items) ? items : items ? [items] : [];
    doctors.map(normalizeDoctor).forEach((doctor) => {
      if (doctor.id) byId.set(doctor.id, doctor);
    });
  };

  try {
    const queryParams: any = {};
    if (params?.latitude !== undefined && params?.longitude !== undefined) {
      queryParams.lat = params.latitude;
      queryParams.lon = params.longitude;
    }
    if (params?.radius) queryParams.radius = params.radius;
    if (params?.specialty && params.specialty !== 'All') queryParams.specialty = params.specialty;
    if (params?.search) queryParams.q = params.search;
    if (params?.nearby) queryParams.nearby = 'true';

    const allRes = await API.get('/user/doctor/all', { params: queryParams });
    const data = allRes.data?.data ?? allRes.data;
    if (Array.isArray(data) && data.length > 0) {
      return data.map((doc: any) => ({
        ...normalizeDoctor(doc),
        availableSlots: Array.isArray(doc.availableSlots)
          ? filterUpcomingSlots(doc.availableSlots.map(normalizeSlot))
          : [],
      }));
    }
  } catch (err) {
    console.warn('Direct doctor fetch failed, falling back:', err);
  }

  try {
    const myDoctor = await API.get('/user/doctor/my');
    addDoctors(myDoctor.data?.data ?? myDoctor.data);
  } catch (error: any) {}

  const searchTerms = ['a', 'e', 'i', 'o', 'u', 'r', 's', 'dr'];
  const responses = await Promise.allSettled(
    searchTerms.map(term => API.get(`/user/doctor/search/${encodeURIComponent(term)}`))
  );

  responses.forEach((result) => {
    if (result.status === 'fulfilled') {
      addDoctors(result.value.data?.data ?? result.value.data);
    }
  });

  const doctors = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  const doctorsWithSlots = await Promise.all(
    doctors.map(async (doctor) => {
      try {
        const availableSlots = await getAvailableSlots(doctor.id, '');
        return { ...doctor, availableSlots };
      } catch (error: any) {
        return { ...doctor, availableSlots: [] };
      }
    })
  );

  return doctorsWithSlots;
}

export async function getAvailableSlots(doctorId: string, date: string) {
  const response = await API.get(`/user/meetings/slot/${doctorId}`, { params: date ? { date } : undefined });
  const slots = response.data?.availableSlots ?? response.data?.data ?? [];
  const normalizedSlots = Array.isArray(slots) ? slots.map(normalizeSlot) : [];
  const upcomingSlots = filterUpcomingSlots(normalizedSlots);
  return date ? upcomingSlots.filter(slot => slot.bookingDate === date || slot.date === date) : upcomingSlots;
}

export async function bookAppointment(payload: {
  doctorId: string;
  slotId: string;
  appointmentDate?: string;
  reasonOfAppointment?: string;
}) {
  await API.get(`/user/doctor/${payload.doctorId}`).catch((error) => {
    console.warn('Could not register selected doctor before booking:', error?.response?.data?.message || error?.message);
  });

  const response = await API.post('/user/meetings/book', payload);
  const body = response.data ?? {};
  return {
    ...(body.data ?? {}),
    success: body.success,
    message: body.message,
    appointmentId: body.data?.appointmentId ?? body.appointmentId ?? body.id,
    raw: body,
  };
}

export async function getPatientAppointments() {
  const response = await API.get('/user/meetings/all');
  const appointments = response.data?.data ?? response.data ?? [];
  return Array.isArray(appointments) ? appointments.map(normalizeAppointment) : [];
}

export async function getDoctorAppointments() {
  const response = await API.get('/doctor/meetings/all');
  const appointments = response.data?.data ?? response.data ?? [];
  return Array.isArray(appointments) ? appointments.map(normalizeAppointment) : [];
}

export async function getDoctorPatients() {
  const byId = new Map<string, any>();

  try {
    const response = await API.get('/doctor/user/my');
    const patients = response.data?.data ?? response.data ?? [];
    if (Array.isArray(patients)) {
      patients.map(normalizePatient).forEach((patient) => {
        if (patient._id) byId.set(patient._id, patient);
      });
    }
  } catch (error: any) {
    console.warn('Could not fetch registered patients:', error?.response?.status || error?.message);
  }

  try {
    const appointments = await getDoctorAppointments();
    appointments
      .filter((appointment: any) => ['confirmed', 'completed'].includes(appointment.status))
      .forEach((appointment: any) => {
        const patient = appointment.patient ?? {};
        const patientId = String(patient.id ?? appointment.patientId ?? '');
        if (!patientId) return;
        const existing = byId.get(patientId);
        const appointmentHistory = [
          ...(existing?.appointments ?? existing?.appointmentHistory ?? []),
          {
            id: appointment.id,
            date: appointment.appointmentDate || appointment.date,
            slotTime: appointment.slotTime || appointment.startTime,
            status: appointment.status,
            reason: appointment.reason || appointment.reasonOfAppointment,
          },
        ];
        byId.set(patientId, normalizePatient({
          ...(existing ?? {}),
          id: patientId,
          name: patient.name || appointment.patientName || existing?.name,
          email: patient.email || appointment.patientEmail || existing?.email,
          number: patient.phoneNumber || appointment.patientContact || existing?.number,
          age: patient.age || appointment.patientAge || existing?.age,
          gender: patient.gender || appointment.patientGender || existing?.gender,
          appointmentHistory,
        }));
      });
  } catch (error: any) {
    console.warn('Could not derive patients from confirmed appointments:', error?.response?.status || error?.message);
  }

  return [...byId.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

export async function getDoctorSlots(params?: { status?: string; fromDate?: string; toDate?: string }) {
  const response = await API.get('/doctor/slot/all', { params });
  const slots = response.data?.data ?? response.data ?? [];
  const normalized = Array.isArray(slots) ? slots.map(normalizeSlot).filter(Boolean) : [];
  return normalized;
}

export async function publishDoctorSlotsSchedule(payload: {
  startDate: string;
  endDate: string;
  slotDurationMinutes: number;
  weeklyRules: { dayOfWeek: number; startTime: string; endTime: string }[];
}) {
  const response = await API.post('/doctor/slot/publish', payload);
  return response.data;
}

export async function publishDoctorSlot(
  bookingDateOrPayload:
    | string
    | {
        bookingDate: string;
        startTime?: string;
        endTime?: string;
        slotTime?: string;
        slotDurationMinutes?: number;
      },
  maybeSlotTime?: string
) {
  const payload =
    typeof bookingDateOrPayload === 'string'
      ? { bookingDate: bookingDateOrPayload, slotTime: maybeSlotTime }
      : bookingDateOrPayload;

  const response = await API.post('/doctor/slot/publish', payload);
  return response.data;
}

export async function deleteDoctorSlot(slotId: string | number) {
  const response = await API.delete(`/doctor/slot/${slotId}`);
  return response.data;
}

export async function deleteDoctorSlotsByRange(fromDate: string, toDate: string) {
  const response = await API.delete('/doctor/slot', { params: { fromDate, toDate } });
  return response.data;
}

export async function deleteDoctorSlotsBulk(slotIds: string[]) {
  const response = await Promise.all(
    slotIds.map(id => API.delete(`/doctor/slot/${id}`))
  );
  return response.map(res => res.data);
}
