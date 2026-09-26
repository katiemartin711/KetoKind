import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import { ON_DEVICE_MODEL_MB } from '../../llm/model';

interface Props {
  trackCalories: boolean;
  onTrackCaloriesChange: (v: boolean) => void;
  nativeAvailable: boolean;
  modelReady: boolean;
  downloading: boolean;
  progress: number | null;
  onDownload: () => void;
  onDeleteModel: () => void;
}

/** Calorie toggle and the on-device model download (including after a decline). */
export default function OnDeviceSection({
  trackCalories,
  onTrackCaloriesChange,
  nativeAvailable,
  modelReady,
  downloading,
  progress,
  onDownload,
  onDeleteModel,
}: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pct = progress == null ? null : Math.round(progress * 100);

  return (
    <View style={common.card}>
      <Text style={common.h2}>On-device meal estimates</Text>
      <Text style={styles.hint}>
        A small model can estimate protein, fat, total carbs, fiber, and net carbs from what you
        type. Estimates are free. Symptom correlations and a written Trends summary are part of
        Pro. The model runs on this phone — your logs are not uploaded.
      </Text>
      <TouchableOpacity
        style={styles.row}
        onPress={() => onTrackCaloriesChange(!trackCalories)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: trackCalories }}
        accessibilityLabel="Track calories"
      >
        <View style={[styles.checkbox, trackCalories && styles.checkboxActive]}>
          {trackCalories && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.label}>Track calories</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        Off by default. Turn this on to show calories on meals and include them in Trends.
      </Text>
      {!nativeAvailable ? (
        <Text style={styles.hint}>
          This install cannot run the model (Expo Go). Meal logging still works. A development
          build can download it.
        </Text>
      ) : modelReady ? (
        <>
          <Text style={styles.status}>Model downloaded</Text>
          <TouchableOpacity style={common.secondaryButton} onPress={onDeleteModel}>
            <Text style={common.secondaryButtonText}>Remove model</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.status}>
            {downloading
              ? `Downloading…${pct == null ? '' : ` ${pct}%`}`
              : `Not downloaded (about ${ON_DEVICE_MODEL_MB} MB)`}
          </Text>
          <TouchableOpacity
            style={common.primaryButton}
            onPress={onDownload}
            disabled={downloading}
            accessibilityRole="button"
            accessibilityLabel="Download on-device model"
          >
            <Text style={common.primaryButtonText}>
              {downloading ? 'Downloading…' : 'Download model'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 14, color: C.muted, marginBottom: 8, lineHeight: 20 },
    row: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
    checkmark: { color: '#fff', fontWeight: '700', fontSize: 15 },
    label: { fontSize: 15, color: C.text },
    status: { fontSize: 14, color: C.text, marginBottom: 8, fontWeight: '600' },
  });
