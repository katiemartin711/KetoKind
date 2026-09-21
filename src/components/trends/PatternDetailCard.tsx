import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import { MIN_BASELINE_DAYS, MIN_COMPARISON_DAYS, diffLabel, round1 } from '../../trendsStats';
import type { DayBuckets, PatternComparison } from '../../trendsStats';

interface Props {
  symptomName: string;
  itemLabel: string;
  /** 'taken' for meds/supplements, 'logged' for foods — wording variant. */
  onDaysWord: 'taken' | 'logged';
  comparison: PatternComparison | null;
  buckets: DayBuckets;
}

/**
 * The symptom × item comparison card: average severity on days with the
 * item vs. days without, or the insufficient-data state. Copy describes
 * patterns in the logs only — never causal, per App Store safety.
 */
export default function PatternDetailCard({
  symptomName,
  itemLabel,
  onDaysWord,
  comparison,
  buckets,
}: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const withLabel = onDaysWord === 'taken' ? 'days taken' : 'days with';
  const withoutLabel = onDaysWord === 'taken' ? 'days not taken' : 'days without';
  return (
    <View style={common.card}>
      <Text style={common.h2}>
        {symptomName} — on days you logged {itemLabel}
      </Text>
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {comparison ? round1(comparison.avgTaken).toFixed(1) : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            {`avg severity · ${withLabel} (${buckets.taken.length})`}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {comparison ? round1(comparison.avgNotTaken).toFixed(1) : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            {`avg severity · ${withoutLabel} (${buckets.notTaken.length})`}
          </Text>
        </View>
      </View>
      {comparison ? (
        <Text style={[styles.body, { color: colors.text }]}>
          {`Severity averaged ${diffLabel(comparison.diff, onDaysWord)} — ${comparison.daysTaken} days with vs. ${comparison.daysNotTaken} days without ${itemLabel}, on days you logged ${symptomName}.`}
        </Text>
      ) : (
        <Text style={[styles.body, { color: colors.muted }]}>
          {`Not enough data yet — patterns need at least ${MIN_COMPARISON_DAYS} days on each side and ${MIN_BASELINE_DAYS}+ days on one side, on days you logged ${symptomName}. So far: ${buckets.taken.length} days with, ${buckets.notTaken.length} days without ${itemLabel}.`}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    body: { fontSize: 14, lineHeight: 20 },
    statRow: { flexDirection: 'row', gap: 12, marginBottom: 12, marginTop: 4 },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '700' },
    statLabel: { fontSize: 11, textAlign: 'center', marginTop: 2, lineHeight: 15 },
  });
