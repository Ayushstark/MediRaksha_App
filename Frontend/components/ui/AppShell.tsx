import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../constants/theme';

export const AppShell = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.shell}>{children}</View>
);

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
