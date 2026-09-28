import React, { createContext, useContext, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '../../constants/theme';

type ToastType = 'success' | 'error' | 'info';

type ToastPayload = {
  message: string;
  type?: ToastType;
};

type ToastContextValue = {
  showToast: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const value = useMemo(() => ({
    showToast: (payload: ToastPayload) => {
      setToast({ ...payload, type: payload.type || 'info' });
      setTimeout(() => setToast(null), 2600);
    },
  }), []);

  const icon = toast?.type === 'success'
    ? 'checkmark-circle'
    : toast?.type === 'error'
      ? 'alert-circle'
      : 'information-circle';
  const accent = toast?.type === 'success'
    ? colors.success
    : toast?.type === 'error'
      ? colors.danger
      : colors.primary;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Modal visible={Boolean(toast)} transparent animationType="fade">
        <View pointerEvents="none" style={styles.overlay}>
          {toast ? (
            <View style={styles.toast}>
              <Ionicons name={icon} size={22} color={accent} />
              <Text style={styles.message}>{toast.message}</Text>
            </View>
          ) : null}
        </View>
      </Modal>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 58,
    paddingHorizontal: spacing.xl,
  },
  toast: {
    width: '100%',
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  message: {
    color: colors.text,
    fontWeight: '800',
    marginLeft: spacing.sm,
    flex: 1,
  },
});
