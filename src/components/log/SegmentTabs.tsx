import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import type { LogSegment } from '../../types';

export interface SegmentOption {
  key: LogSegment;
  label: string;
}

interface Props {
  segments: SegmentOption[];
  active: LogSegment;
  onSelect: (key: LogSegment) => void;
}

/** The Meal / Meds & Supps / Symptom / Weight segmented control. */
export default function SegmentTabs({ segments, active, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {segments.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={[styles.segment, active === s.key && styles.segmentActive]}
          onPress={() => onSelect(s.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === s.key }}
        >
          <Text style={[styles.segmentText, active === s.key && styles.segmentTextActive]}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    segments: {
      flexDirection: 'row',
      backgroundColor: C.border,
      borderRadius: 12,
      padding: 4,
      marginBottom: 12,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentActive: { backgroundColor: C.card },
    segmentText: { fontSize: 13, fontWeight: '600', color: C.muted },
    segmentTextActive: { color: C.accent },
  });
