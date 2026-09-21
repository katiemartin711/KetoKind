import React, { useMemo } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import ListRow from './ListRow';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  title: string;
  items: { id: number; name: string }[];
  inputValue: string;
  onInputChange: (s: string) => void;
  inputPlaceholder: string;
  onAdd: () => void;
  onDelete: (id: number) => void;
}

/** Generic titled list with an add-row — used for allergies and conditions. */
export default function SimpleListSection({
  title,
  items,
  inputValue,
  onInputChange,
  inputPlaceholder,
  onAdd,
  onDelete,
}: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      <Text style={common.h2}>{title}</Text>
      {items.map((item) => (
        <ListRow key={item.id} label={item.name} onDelete={() => onDelete(item.id)} />
      ))}
      <View style={styles.addRow}>
        <TextInput
          style={[common.input, styles.addInput]}
          placeholder={inputPlaceholder}
          value={inputValue}
          onChangeText={onInputChange}
          onSubmitEditing={onAdd}
          maxLength={80}
        />
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    addRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
    addInput: { flex: 1 },
    addButton: {
      backgroundColor: C.accent,
      borderRadius: 10,
      paddingHorizontal: 18,
      justifyContent: 'center',
    },
    addButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
