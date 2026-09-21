// "KetoKind Pro" status row on the Profile tab: shows Free / Pro ✓ and
// opens the paywall when tapped while free.
import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  isPro: boolean;
  onPress: () => void;
}

export default function ProSection({ isPro, onPress }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={common.card}
      onPress={onPress}
      disabled={isPro}
      accessibilityRole="button"
      accessibilityLabel={isPro ? 'KetoKind Pro active' : 'KetoKind Pro — upgrade'}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={common.h2}>KetoKind Pro</Text>
          <Text style={styles.hint}>
            {isPro
              ? 'Pro is active — AI Coach export and backups unlocked.'
              : 'Unlock the AI Coach export plus backup export & import.'}
          </Text>
        </View>
        <Text style={[styles.status, { color: isPro ? colors.accent : colors.muted }]}>
          {isPro ? 'Pro ✓' : 'Free  ›'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    left: { flex: 1, marginRight: 12 },
    hint: { fontSize: 13, color: C.muted, lineHeight: 18 },
    status: { fontSize: 16, fontWeight: '700' },
  });
