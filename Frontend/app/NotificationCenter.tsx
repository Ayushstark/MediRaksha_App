import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader, EmptyState } from '../components/ui/AppUI';
import { colors, radius, spacing } from '../constants/theme';
import { useRouter } from 'expo-router';

const previewNotifications = [
  {
    title: 'Appointment reminders',
    body: 'Confirmed appointments will remind you 30 minutes before the visit.',
    icon: 'alarm-outline' as const,
  },
  {
    title: 'Doctor updates',
    body: 'Approvals, slot updates, and report activity will appear here.',
    icon: 'medkit-outline' as const,
  },
];

export default function NotificationCenter() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Notifications"
        subtitle="A calm place for appointment, report, and care updates."
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {previewNotifications.map((item) => (
          <View key={item.title} style={styles.notificationCard}>
            <View style={styles.iconBox}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        ))}

        <EmptyState
          icon="notifications-outline"
          title="No new notifications"
          subtitle="When appointment reminders or care updates arrive, they will be shown here."
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  body: { color: colors.textMuted, lineHeight: 20, marginTop: 4, fontWeight: '600' },
});
