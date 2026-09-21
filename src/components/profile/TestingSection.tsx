// Testing tools at the bottom of the Profile tab: a Pro on/off switch that
// flips the entitlement flag instantly, so the paywall can be exercised as
// both a free and a paid user. Clearly labeled — remove before App Store
// submission.
import React, { useMemo } from 'react';
import { Switch, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  isPro: boolean;
  onToggle: (value: boolean) => void;
}

export default function TestingSection({ isPro, onToggle }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[common.card, styles.testingCard]}>
      <Text style={styles.testingLabel}>Testing</Text>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={[common.h2, styles.title]}>Simulate Pro user</Text>
          <Text style={styles.hint}>
            Testing tool — flips the Pro flag instantly with no purchase, so you
            can preview the app as a free or paid user.
          </Text>
        </View>
        <Switch
          value={isPro}
          onValueChange={onToggle}
          trackColor={{ true: colors.accent }}
          accessibilityLabel="Simulate Pro user"
          accessibilityRole="switch"
        />
      </View>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    testingCard: { borderStyle: 'dashed' },
    testingLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: C.muted,
      marginBottom: 8,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    left: { flex: 1, marginRight: 12 },
    title: { marginBottom: 4 },
    hint: { fontSize: 13, color: C.muted, lineHeight: 18 },
  });
