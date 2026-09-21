import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  value: number;
  options: { key: number; label: string }[];
  onChange: (key: number) => void;
  a11yLabel: string;
}

/** Minimal dropdown (button + modal list): pure JS, no native picker module
 *  needed, styled to match the app's inputs. */
export default function Dropdown({ value, options, onChange, a11yLabel }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <View>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.dropdownButtonText}>{selected?.label ?? ''}</Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={`Close ${a11yLabel}`}
        >
          <View style={styles.dropdownList}>
            {options.map((o, i) => {
              const active = o.key === value;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    styles.dropdownOption,
                    i === options.length - 1 && styles.dropdownOptionLast,
                  ]}
                  onPress={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${a11yLabel}: ${o.label}`}
                >
                  <Text
                    style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: C.input,
      minWidth: 150,
      marginBottom: 4,
    },
    dropdownButtonText: { fontSize: 14, color: C.text, fontWeight: '600' },
    dropdownChevron: { fontSize: 14, color: C.muted, marginLeft: 8 },
    dropdownOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    dropdownList: {
      backgroundColor: C.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      minWidth: 230,
      overflow: 'hidden',
    },
    dropdownOption: {
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    dropdownOptionLast: { borderBottomWidth: 0 },
    dropdownOptionText: { fontSize: 15, color: C.text },
    dropdownOptionTextActive: { color: C.accent, fontWeight: '700' },
  });
