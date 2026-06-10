import API from '../apiClient';

export const toDateString = (value: Date) => {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
};

export const normalizeSpeciality = (value: any) => {
  const text = String(value || '').trim();
  return text || 'General';
};

export const normalizeDoctor = (doctor: any) => ({
  ...doctor,
  _id: String(doctor.id ?? doctor._id ?? ''),
  id: String(doctor.id ?? doctor._id ?? ''),
  doctorId: String(doctor.id ?? doctor._id ?? ''),
  specialization: normalizeSpeciality(doctor.speciality ?? doctor.specialization),
  specialty: normalizeSpeciality(doctor.speciality ?? doctor.specialization),
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
  date: appointment.appointmentDate,
  startTime: appointment.slotTime,
  reason: appointment.reasonOfAppointment,
  patient: appointment.patient ?? {
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
  date: slot.bookingDate,
  time: String(slot.slotTime || '').slice(0, 5),
});

export async function getCurrentProfile(role?: string) {
  const isDoctor = role === 'Doctor';
  const response = await API.get(isDoctor ? '/doctor/info/detail' : '/user/info/detail');
  const data = response.data?.data ?? response.data;
  return isDoctor ? normalizeDoctor(data) : normalizePatient(data);
}

export async function getDoctors() {
  const response = await API.get('/user/doctor/search/Dr');
  const doctors = response.data?.data ?? response.data ?? [];
  return Array.isArray(doctors) ? doctors.map(normalizeDoctor) : [];
}

export async function getAvailableSlots(doctorId: string, date: string) {
  const response = await API.get(`/user/meetings/slot/${doctorId}`, { params: { date } });
  const slots = response.data?.availableSlots ?? response.data?.data ?? [];
  return Array.isArray(slots) ? slots.map(normalizeSlot) : [];
}

export async function bookAppointment(payload: {
  doctorId: string;
  slotId: string;
  appointmentDate?: string;
  reasonOfAppointment?: string;
}) {
  const response = await API.post('/user/meetings/book', payload);
  return response.data?.data ?? response.data;
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
  const response = await API.get('/doctor/user/my');
  const patients = response.data?.data ?? response.data ?? [];
  return Array.isArray(patients) ? patients.map(normalizePatient) : [];
}

export async function getDoctorSlots() {
  const response = await API.get('/doctor/slot/all');
  const slots = response.data?.data ?? response.data ?? [];
  return Array.isArray(slots) ? slots.map(normalizeSlot) : [];
}

export async function publishDoctorSlot(bookingDate: string, slotTime: string) {
  const response = await API.post('/doctor/slot/publish', { bookingDate, slotTime });
  return normalizeSlot(response.data?.data ?? response.data);
}
