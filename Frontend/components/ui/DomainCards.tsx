import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '../../constants/theme';
import { formatAppointmentDateTime } from '../../services/medirakshaApi';

export const DoctorCard = ({
  doctor,
  onPress,
}: {
  doctor: any;
  onPress: () => void;
}) => {
  const slots = (doctor.availableSlots || []).filter((slot: any) => slot.status !== 'booked');
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.86}>
      <View style={styles.row}>
        <LinearGradient colors={['#1A237E', '#3762F0']} style={styles.avatar}>
          <FontAwesome5 name="user-md" size={22} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.title}>Dr. {doctor.name}</Text>
          <Text style={styles.meta}>{doctor.specialization || doctor.specialty || 'General Physician'}</Text>
          <Text style={styles.subMeta} numberOfLines={1}>{doctor.hospital || 'MediRaksha Clinic'}</Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name="time-outline" size={13} color={slots.length ? colors.success : colors.textSoft} />
          <Text style={[styles.pillText, !slots.length && { color: colors.textSoft }]}>{slots.length}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const AppointmentTimeline = ({ appointments }: { appointments: any[] }) => (
  <View style={styles.timeline}>
    {appointments.map((appointment, index) => {
      const status = String(appointment.status || 'pending').toLowerCase();
      const accent = status === 'confirmed'
        ? colors.success
        : status === 'completed'
          ? colors.primary
          : status === 'missed'
            ? '#9333EA'
            : status === 'cancelled'
              ? colors.danger
              : colors.warning;

      return (
        <View key={appointment.id || appointment._id || index} style={styles.timelineRow}>
          <View style={styles.timelineRail}>
            <View style={[styles.timelineDot, { backgroundColor: accent }]} />
            {index < appointments.length - 1 ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.timelineCard}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{appointment.doctorName || appointment.patient?.name || appointment.patientName || 'Appointment'}</Text>
                <Text style={styles.meta}>{formatAppointmentDateTime(appointment)}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${accent}18` }]}>
                <Text style={[styles.statusText, { color: accent }]}>{status}</Text>
              </View>
            </View>
            <Text style={styles.reason} numberOfLines={2}>
              {appointment.reason || appointment.reasonOfAppointment || 'No reason added.'}
            </Text>
          </View>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 54, height: 54, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  meta: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 3 },
  subMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillText: { color: colors.success, fontSize: 12, fontWeight: '900', marginLeft: 4 },
  timeline: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 28, alignItems: 'center' },
  timelineDot: { width: 13, height: 13, borderRadius: 7, marginTop: spacing.xl },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: spacing.xs },
  timelineCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPill: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  reason: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 19, fontWeight: '600' },
});
