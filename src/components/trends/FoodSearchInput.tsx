import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Shown under the input when the keyword expanded to a food group,
   *  e.g. "matching: cheese, cream, butter, milk…". */
  matchHint: string | null;
}

/** Search-bar style food input for the Trends food × symptom comparison. */
export default function FoodSearchInput({ value, onChange, matchHint }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View>
      <TextInput
        style={common.input}
        value={value}
        onChangeText={onChange}
        placeholder="Type a food, e.g. eggs or dairy"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityRole="search"
        accessibilityLabel="Food to compare with the symptom"
      />
      {matchHint ? (
        <Text style={styles.hint} accessibilityLabel={`Food group expands to ${matchHint}`}>
          {matchHint}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    hint: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 16 },
  });
