import React, { useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import { fmtDateTimeFromDate } from '../../datetime';

/** A "Time" field for the log forms: shows the chosen date/time, taps open a
 *  native picker (dialog on Android, inline on iOS). Future times are blocked. */
export default function DateTimeField({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const { colors: COLORS, common, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text style={common.label}>Time</Text>
      <TouchableOpacity
        style={common.input}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Change time, currently ${fmtDateTimeFromDate(value)}`}
      >
        <Text style={{ fontSize: 16, color: COLORS.text }}>{fmtDateTimeFromDate(value)}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            mode="datetime"
            value={value}
            maximumDate={new Date()}
            themeVariant={isDark ? 'dark' : 'light'}
            onValueChange={(_event, date) => {
              onChange(date);
              // Android's dialog presentation: close once a value is picked.
              if (Platform.OS === 'android') setOpen(false);
            }}
            onDismiss={() => setOpen(false)}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={common.secondaryButton} onPress={() => setOpen(false)}>
              <Text style={common.secondaryButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    pickerWrap: { marginTop: 8 },
  });
