import API from '../apiClient';

export const toDateString = (value: Date) => {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
};

export const normalizeTime = (value: any) => String(value ?? '').slice(0, 5);

export const formatAppointmentDateTime = (appointment: any) => {
  const date = String(appointment.appointmentDate ?? appointment.date ?? '').slice(0, 10);
  const time = normalizeTime(appointment.slotTime ?? appointment.startTime ?? appointment.time);
  if (!date && !time) return 'Date/time not set';
  const dateLabel = date ? new Date(`${date}T00:00:00`).toLocaleDateString() : 'Date not set';
  return time ? `${dateLabel} at ${time}` : dateLabel;
};

export const normalizeSpeciality = (value: any) => {
  const text = String(value || '').trim();
  const normalized = text.toLowerCase();
  if (!normalized || normalized === 'general' || normalized === 'general medicine') return 'General Physician';
  if (normalized === 'cardiology' || normalized === 'cardiologist') return 'Cardiologist';
  if (normalized === 'neurology' || normalized === 'neurologist') return 'Neurologist';
  if (normalized === 'orthopedics' || normalized === 'orthopedic') return 'Orthopedics';
  if (normalized === 'pediatrics' || normalized === 'pediatrician') return 'Pediatrics';
  if (normalized === 'dermatology' || normalized === 'dermatologist') return 'Dermatology';
  return text;
};

export const normalizeDoctor = (doctor: any) => ({
  ...doctor,
  _id: String(doctor.id ?? doctor._id ?? ''),
  id: String(doctor.id ?? doctor._id ?? ''),
  doctorId: String(doctor.id ?? doctor._id ?? ''),
  specialization: normalizeSpeciality(doctor.speciality ?? doctor.specialization),
  specialty: normalizeSpeciality(doctor.speciality ?? doctor.specialization),
  availableSlots: Array.isArray(doctor.availableSlots)
    ? doctor.availableSlots.map(normalizeSlot)
    : Array.isArray(doctor.slots)
      ? doctor.slots.map(normalizeSlot)
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

export const normalizeSlot = (slot: any) => ({
  ...slot,
  _id: String(slot.id ?? slot._id ?? ''),
  id: String(slot.id ?? slot._id ?? ''),
  bookingDate: String(slot.bookingDate ?? slot.date ?? '').slice(0, 10),
  date: String(slot.date ?? slot.bookingDate ?? '').slice(0, 10),
  slotTime: String(slot.slotTime ?? slot.time ?? '').slice(0, 5),
  time: String(slot.time ?? slot.slotTime ?? '').slice(0, 5),
});

export async function getCurrentProfile(role?: string) {
  const isDoctor = role === 'Doctor';
  const response = await API.get(isDoctor ? '/doctor/info/detail' : '/user/info/detail');
  const data = response.data?.data ?? response.data;
  return isDoctor
    ? { ...normalizeDoctor(data), role: 'Doctor' }
    : { ...normalizePatient(data), role: 'Patient' };
}

export async function getDoctors() {
  const byId = new Map<string, any>();
  const addDoctors = (items: any) => {
    const doctors = Array.isArray(items) ? items : items ? [items] : [];
    doctors.map(normalizeDoctor).forEach((doctor) => {
      if (doctor.id) byId.set(doctor.id, doctor);
    });
  };

  try {
    const myDoctor = await API.get('/user/doctor/my');
    addDoctors(myDoctor.data?.data ?? myDoctor.data);
  } catch (error: any) {
    if (error?.response?.status && error.response.status !== 404) {
      console.warn('Could not fetch registered doctor:', error.response.status);
    }
  }

  const searchTerms = ['ra', 'ar', 'ma', 'sh', 'ch', 'an', 'dr', 'ku', 'pa', 'sa', 'ka', 'na'];
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
        console.warn(`Could not fetch slots for doctor ${doctor.id}:`, error?.response?.status || error?.message);
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
  return date ? normalizedSlots.filter(slot => slot.bookingDate === date || slot.date === date) : normalizedSlots;
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

export async function getDoctorSlots() {
  const response = await API.get('/doctor/slot/all');
  const slots = response.data?.data ?? response.data ?? [];
  return Array.isArray(slots) ? slots.map(normalizeSlot) : [];
}

export async function publishDoctorSlot(bookingDate: string, slotTime: string) {
  const response = await API.post('/doctor/slot/publish', { bookingDate, slotTime });
  const slot = response.data?.data ?? response.data;
  return normalizeSlot(Array.isArray(slot) ? slot[0] : slot);
}

export async function deleteDoctorSlotsBulk(slotIds: string[]) {
  const response = await Promise.all(
    slotIds.map(id => API.delete(`/doctor/slot/${id}`))
  );
  return response.map(res => res.data);
}
