import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors, gradients, radius, shadows, spacing, typography } from '../../constants/theme';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

type HeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
};

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export const AppCard = ({ children, style }: CardProps) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const AppHeader = ({ title, subtitle, onBack, right }: HeaderProps) => (
  <LinearGradient colors={gradients.hero} style={styles.header}>
    <View style={styles.headerTop}>
      {onBack ? (
        <TouchableOpacity style={styles.headerIcon} onPress={onBack}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerIconSpacer} />
      )}
      {right || <View style={styles.headerIconSpacer} />}
    </View>
    <Text style={styles.headerTitle}>{title}</Text>
    {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
  </LinearGradient>
);

export const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: ButtonProps) => (
  <TouchableOpacity
    style={[
      styles.button,
      variant === 'secondary' && styles.secondaryButton,
      variant === 'danger' && styles.dangerButton,
      disabled && styles.disabledButton,
      style,
    ]}
    onPress={onPress}
    disabled={disabled || loading}
  >
    {loading ? (
      <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
    ) : (
      <>
        {icon}
        <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>
          {title}
        </Text>
      </>
    )}
  </TouchableOpacity>
);

export const PrimaryButton = AppButton;
export const ScreenHeader = AppHeader;

export const AppChip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.activeChip]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.8}
  >
    <Text style={[styles.chipText, active && styles.activeChipText]} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

export const EmptyState = ({
  title,
  subtitle,
  icon = 'calendar-outline',
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: React.ReactNode;
}) => (
  <AppCard style={styles.emptyCard}>
    <Ionicons name={icon} size={48} color={colors.textSoft} />
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    {action}
  </AppCard>
);

export const ErrorState = ({
  title = 'Something went wrong',
  subtitle = 'Please check your connection and try again.',
  onRetry,
}: {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
}) => (
  <AppCard style={styles.emptyCard}>
    <Ionicons name="warning-outline" size={48} color={colors.warning} />
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptySubtitle}>{subtitle}</Text>
    {onRetry ? (
      <AppButton
        title="Retry"
        onPress={onRetry}
        variant="secondary"
        icon={<Ionicons name="refresh" size={18} color={colors.primary} />}
        style={styles.emptyAction}
      />
    ) : null}
  </AppCard>
);

export const AppInput = ({ label, error, style, ...props }: InputProps) => (
  <View style={styles.inputWrap}>
    {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
    <TextInput
      style={[styles.input, error && styles.inputError, style]}
      placeholderTextColor={colors.textSoft}
      {...props}
    />
    {error ? <Text style={styles.inputErrorText}>{error}</Text> : null}
  </View>
);

export const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonAvatar} />
    <View style={{ flex: 1 }}>
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLineShort} />
    </View>
  </View>
);

export const LoadingState = ({ label = 'Loading...' }: { label?: string }) => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.loadingText}>{label}</Text>
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
  header: {
    paddingTop: 54,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconSpacer: {
    width: 42,
    height: 42,
  },
  headerTitle: {
    color: '#fff',
    ...typography.h1,
    marginTop: spacing.xl,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#DDE5FF',
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  disabledButton: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: colors.primary,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'center',
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  activeChipText: {
    color: '#fff',
  },
  emptyCard: {
    alignItems: 'center',
    margin: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  emptyAction: {
    marginTop: spacing.lg,
    minWidth: 140,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  inputWrap: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  inputErrorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    marginRight: spacing.md,
  },
  skeletonLineWide: {
    height: 14,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    width: '82%',
    marginBottom: spacing.sm,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    width: '62%',
    marginBottom: spacing.sm,
  },
  skeletonLineShort: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    width: '38%',
  },
});
