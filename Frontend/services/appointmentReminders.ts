import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { normalizeTime } from './medirakshaApi';

type ReminderInput = {
  id: string;
  role: 'patient' | 'doctor';
  appointmentDate?: string;
  date?: string;
  slotTime?: string;
  startTime?: string;
  doctorName?: string;
  patientName?: string;
};

const getAppointmentDate = (appointment: ReminderInput) => {
  const date = String(appointment.appointmentDate || appointment.date || '').slice(0, 10);
  const time = normalizeTime(appointment.slotTime || appointment.startTime);
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const isExpoGo = Constants.appOwnership === 'expo';
let didWarnExpoGoNotifications = false;

const loadNotifications = async () => {
  if (isExpoGo) {
    if (!didWarnExpoGoNotifications) {
      console.warn('Appointment reminders are skipped in Expo Go. Use a development build for local notifications.');
      didWarnExpoGoNotifications = true;
    }
    return null;
  }

  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  return Notifications;
};

const ensureNotificationPermission = async (Notifications: Awaited<ReturnType<typeof loadNotifications>>) => {
  if (!Notifications) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Appointment reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

export const scheduleAppointmentReminder = async (appointment: ReminderInput) => {
  if (!appointment.id) return;

  const Notifications = await loadNotifications();
  if (!Notifications) return;

  const appointmentAt = getAppointmentDate(appointment);
  if (!appointmentAt) return;

  const reminderAt = new Date(appointmentAt.getTime() - 30 * 60 * 1000);
  if (reminderAt.getTime() <= Date.now()) return;

  const storeKey = `appointmentReminder:${appointment.role}:${appointment.id}`;
  const existingNotificationId = await SecureStore.getItemAsync(storeKey);
  if (existingNotificationId) return;

  const hasPermission = await ensureNotificationPermission(Notifications);
  if (!hasPermission) return;

  const title = 'Appointment reminder';
  const timeText = normalizeTime(appointment.slotTime || appointment.startTime);
  const body = appointment.role === 'doctor'
    ? `Patient ${appointment.patientName || 'Patient'} has an appointment at ${timeText}.`
    : `Your appointment with Dr. ${appointment.doctorName || 'Doctor'} is at ${timeText}.`;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { appointmentId: appointment.id, role: appointment.role },
    },
    trigger: { channelId: 'appointments', date: reminderAt } as any,
  });

  await SecureStore.setItemAsync(storeKey, notificationId);
};

export const scheduleAppointmentReminders = async (
  appointments: ReminderInput[],
  role: 'patient' | 'doctor'
) => {
  await Promise.all(
    appointments.map((appointment) => scheduleAppointmentReminder({ ...appointment, role }))
  );
};
