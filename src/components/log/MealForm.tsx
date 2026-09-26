import React, { useMemo } from 'react';
import { Switch, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import DateTimeField from './DateTimeField';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import type { MealFavorite } from '../../types';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

interface Props {
  mealName: string;
  onMealNameChange: (s: string) => void;
  mealType: string;
  onMealTypeChange: (s: string) => void;
  mealNotes: string;
  onMealNotesChange: (s: string) => void;
  logDate: Date;
  onLogDateChange: (d: Date) => void;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
  trackCalories: boolean;
  protein: string;
  fat: string;
  carbs: string;
  fiber: string;
  calories: string;
  onProteinChange: (s: string) => void;
  onFatChange: (s: string) => void;
  onCarbsChange: (s: string) => void;
  onFiberChange: (s: string) => void;
  onCaloriesChange: (s: string) => void;
  estimating: boolean;
  favorite: boolean;
  onFavoriteChange: (value: boolean) => void;
  favorites: MealFavorite[];
  onUseFavorite: (id: number) => void;
  onRemoveFavorite: (id: number) => void;
}

export default function MealForm(props: Props) {
  const {
    mealName,
    onMealNameChange,
    mealType,
    onMealTypeChange,
    mealNotes,
    onMealNotesChange,
    logDate,
    onLogDateChange,
    editing,
    onSave,
    onCancel,
    trackCalories,
    protein,
    fat,
    carbs,
    fiber,
    calories,
    onProteinChange,
    onFatChange,
    onCarbsChange,
    onFiberChange,
    onCaloriesChange,
    estimating,
    favorite,
    onFavoriteChange,
    favorites,
    onUseFavorite,
    onRemoveFavorite,
  } = props;
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={common.card}>
      {favorites.length > 0 && (
        <View style={styles.favorites}>
          <Text style={common.label}>Favorites</Text>
          {favorites.map((fav) => (
            <View key={fav.id} style={styles.favoriteRow}>
              <TouchableOpacity
                style={styles.favoriteMain}
                onPress={() => onUseFavorite(fav.id)}
                accessibilityRole="button"
                accessibilityLabel={`Log ${fav.name}`}
              >
                <Text style={[styles.favoriteName, { color: colors.text }]}>{fav.name}</Text>
                <Text style={styles.hint}>{fav.meal_type}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRemoveFavorite(fav.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${fav.name} from favorites`}
                hitSlop={8}
              >
                <Text style={[styles.remove, { color: colors.muted }]}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <Text style={common.label}>What did you eat?</Text>
      <Text style={styles.hint}>
        More detail, including amounts, makes the macro estimate and insights more accurate.
      </Text>
      <TextInput
        style={common.input}
        placeholder="e.g. Ribeye steak, 3 eggs"
        value={mealName}
        onChangeText={onMealNameChange}
        maxLength={120}
        accessibilityLabel="What did you eat?"
      />
      <Text style={common.label}>Meal</Text>
      <View style={styles.chips}>
        {MEAL_TYPES.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, mealType === m && styles.chipActive]}
            onPress={() => onMealTypeChange(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: mealType === m }}
          >
            <Text style={[styles.chipText, mealType === m && styles.chipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={common.label}>Notes (optional)</Text>
      <TextInput
        style={common.input}
        placeholder="How was it?"
        value={mealNotes}
        onChangeText={onMealNotesChange}
        maxLength={200}
        accessibilityLabel="Notes, optional"
      />
      <View style={styles.favoriteToggle}>
        <View style={styles.favoriteCopy}>
          <Text style={[styles.favoriteName, { color: colors.text }]}>Save as favorite</Text>
          <Text style={styles.hint}>Keep this meal in the list above so you can log it again.</Text>
        </View>
        <Switch
          value={favorite}
          onValueChange={onFavoriteChange}
          trackColor={{ true: colors.accent }}
          accessibilityLabel="Save as favorite"
          accessibilityRole="switch"
        />
      </View>
      <Text style={common.label}>Macros (optional)</Text>
      <Text style={styles.hint}>
        Leave these blank to estimate protein, fat, and carbs on this phone after you save.
        Fill them in if you already know the numbers.
      </Text>
      <View style={styles.macroRow}>
        <MacroField label="Protein (g)" value={protein} onChange={onProteinChange} />
        <MacroField label="Fat (g)" value={fat} onChange={onFatChange} />
      </View>
      <View style={styles.macroRow}>
        <MacroField label="Total carbs (g)" value={carbs} onChange={onCarbsChange} />
        <MacroField label="Fiber (g)" value={fiber} onChange={onFiberChange} />
      </View>
      {trackCalories && (
        <MacroField label="Calories" value={calories} onChange={onCaloriesChange} />
      )}
      {estimating && <Text style={styles.hint}>Estimating macros on this phone…</Text>}
      <DateTimeField value={logDate} onChange={onLogDateChange} />
      <TouchableOpacity style={common.primaryButton} onPress={onSave}>
        <Text style={common.primaryButtonText}>{editing ? 'Save changes' : 'Save meal'}</Text>
      </TouchableOpacity>
      {editing && (
        <TouchableOpacity style={common.secondaryButton} onPress={onCancel}>
          <Text style={common.secondaryButtonText}>Cancel editing</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  const { common } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={common.label}>{label}</Text>
      <TextInput
        style={common.input}
        keyboardType="decimal-pad"
        placeholder="—"
        value={value}
        onChangeText={onChange}
        maxLength={7}
        accessibilityLabel={label}
      />
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 18 },
    favorites: { marginBottom: 8 },
    favoriteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
    },
    favoriteMain: { flex: 1 },
    favoriteName: { fontSize: 16, fontWeight: '600' },
    remove: { fontSize: 22, paddingHorizontal: 8 },
    favoriteToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    favoriteCopy: { flex: 1 },
    macroRow: { flexDirection: 'row', gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: C.card,
    },
    chipActive: { backgroundColor: C.accent, borderColor: C.accent },
    chipText: { fontSize: 14, color: C.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
  });
