// Time picker modal: hour (1-12), minute, AM/PM steppers. A custom picker
// (no native dependency) so it works identically in Expo Go and builds.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import type { ReminderTime } from '../../reminderLogic';

function Stepper({
  display,
  onUp,
  onDown,
  label,
  C,
  styles,
}: {
  display: string;
  onUp: () => void;
  onDown: () => void;
  label: string;
  C: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.column}>
      <TouchableOpacity
        onPress={onUp}
        style={[styles.chev, { borderColor: C.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
      >
        <Text style={[styles.chevText, { color: C.accent }]}>▲</Text>
      </TouchableOpacity>
      <Text style={[styles.value, { color: C.text }]}>{display}</Text>
      <TouchableOpacity
        onPress={onDown}
        style={[styles.chev, { borderColor: C.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
      >
        <Text style={[styles.chevText, { color: C.accent }]}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TimePickerModal({
  visible,
  title,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initial: ReminderTime;
  onClose: () => void;
  onSave: (t: ReminderTime) => void;
}) {
  const { colors: C, common } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [hour12, setHour12] = useState(8);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('PM');

  // Reset the wheels every time the modal opens.
  useEffect(() => {
    if (visible) {
      const h = initial.hour % 12 === 0 ? 12 : initial.hour % 12;
      setHour12(h);
      setMinute(initial.minute);
      setAmpm(initial.hour < 12 ? 'AM' : 'PM');
    }
  }, [visible, initial.hour, initial.minute]);

  const save = () => {
    const hour = ampm === 'AM' ? hour12 % 12 : hour12 % 12 + 12;
    onSave({ hour, minute });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[common.h2, styles.title]}>{title}</Text>
          <View style={styles.row}>
            <Stepper
              display={String(hour12)}
              label="hour"
              C={C}
              styles={styles}
              onUp={() => setHour12((h) => (h % 12) + 1)}
              onDown={() => setHour12((h) => ((h + 10) % 12) + 1)}
            />
            <Text style={[styles.colon, { color: C.muted }]}>:</Text>
            <Stepper
              display={String(minute).padStart(2, '0')}
              label="minute"
              C={C}
              styles={styles}
              onUp={() => setMinute((m) => (m + 1) % 60)}
              onDown={() => setMinute((m) => (m + 59) % 60)}
            />
            <View style={styles.column}>
              <TouchableOpacity
                onPress={() => setAmpm('AM')}
                style={[styles.ampm, ampm === 'AM' && { backgroundColor: C.accent }]}
                accessibilityRole="button"
                accessibilityLabel="AM"
              >
                <Text style={[styles.ampmText, { color: ampm === 'AM' ? '#fff' : C.text }]}>AM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAmpm('PM')}
                style={[styles.ampm, ampm === 'PM' && { backgroundColor: C.accent }]}
                accessibilityRole="button"
                accessibilityLabel="PM"
              >
                <Text style={[styles.ampmText, { color: ampm === 'PM' ? '#fff' : C.text }]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.buttons}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.button, { borderColor: C.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.buttonText, { color: C.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              style={[styles.button, styles.primary, { backgroundColor: C.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Save time"
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      padding: 20,
      paddingBottom: 32,
    },
    title: { textAlign: 'center', marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
    column: { alignItems: 'center', marginHorizontal: 10 },
    chev: {
      borderWidth: 1,
      borderRadius: 10,
      width: 64,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevText: { fontSize: 18 },
    value: { fontSize: 34, fontWeight: '700', marginVertical: 8, minWidth: 64, textAlign: 'center' },
    colon: { fontSize: 30, fontWeight: '700', marginHorizontal: 2 },
    ampm: {
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 18,
      marginVertical: 4,
    },
    ampmText: { fontSize: 16, fontWeight: '700' },
    buttons: { flexDirection: 'row', marginTop: 8 },
    button: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 14,
      alignItems: 'center',
      marginHorizontal: 6,
    },
    primary: { borderWidth: 0 },
    buttonText: { fontSize: 16, fontWeight: '600' },
  });
