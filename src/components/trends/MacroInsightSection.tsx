import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import { macroDiffSentence, type MacroComparison } from '../../macroCorrelations';

interface Props {
  comparisons: MacroComparison[];
  mealDaysWithMacros: number;
  narrative: string | null;
  busy: boolean;
  modelReady: boolean;
  nativeAvailable: boolean;
  onWrite: () => void;
}

/** Pro: macro-balance comparisons plus an on-demand on-device summary. */
export default function MacroInsightSection({
  comparisons,
  mealDaysWithMacros,
  narrative,
  busy,
  modelReady,
  nativeAvailable,
  onWrite,
}: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      <Text style={[common.h2, { marginTop: 8 }]}>Macro balance</Text>
      <View style={common.card}>
        {comparisons.length === 0 ? (
          <>
            <Text style={styles.title}>Not enough estimated meals yet</Text>
            <Text style={styles.body}>
              {mealDaysWithMacros === 0
                ? 'Save meals and let the on-device model estimate macros (or type them yourself). Patterns compare symptom severity on higher vs. lower macro days once there is enough of both.'
                : `Macros are on ${mealDaysWithMacros} day${mealDaysWithMacros === 1 ? '' : 's'}. Keep logging symptoms on those days — a comparison needs several days on each side of the median.`}
            </Text>
          </>
        ) : (
          comparisons.map((c) => (
            <Text key={`${c.symptomName}|${c.axis}`} style={styles.body}>
              {macroDiffSentence(c)}
            </Text>
          ))
        )}
        {narrative ? <Text style={styles.narrative}>{narrative}</Text> : null}
        {comparisons.length > 0 && (
          modelReady ? (
            <TouchableOpacity
              style={common.secondaryButton}
              onPress={onWrite}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Write a summary of these patterns"
            >
              <Text style={common.secondaryButtonText}>
                {busy ? 'Writing summary…' : narrative ? 'Rewrite summary' : 'Write a summary'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.body}>
              {nativeAvailable
                ? 'Download the on-device model from Profile to write a short summary of these patterns. The comparisons above do not need it.'
                : 'A development build can write the summary on this phone. The comparisons above are already calculated from your logs.'}
            </Text>
          )
        )}
        <Text style={styles.note}>
          Estimates are approximate, not lab values. Patterns in your logs, not medical advice.
        </Text>
      </View>
    </>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    title: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 20, color: C.text, marginBottom: 10 },
    narrative: { fontSize: 15, lineHeight: 22, color: C.text, marginBottom: 10 },
    note: { fontSize: 12, lineHeight: 17, color: C.muted, marginTop: 4 },
  });
