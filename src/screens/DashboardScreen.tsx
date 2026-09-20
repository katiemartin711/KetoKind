// Home tab: today's date, stat cards for today, daily streak,
// and quick-add buttons that jump into the Log tab.

import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { getDayCounts, getStreak } from '../db';
import type { LogSegment, RootTabParamList } from '../types';
import { COLORS, common } from '../theme';

type Nav = BottomTabNavigationProp<RootTabParamList>;

const QUICK_ADD: { label: string; icon: keyof typeof Ionicons.glyphMap; segment: LogSegment }[] = [
  { label: 'Meal', icon: 'restaurant-outline', segment: 'meal' },
  { label: 'Med', icon: 'medkit-outline', segment: 'medication' },
  { label: 'Symptom', icon: 'pulse-outline', segment: 'symptom' },
  { label: 'Supplement', icon: 'leaf-outline', segment: 'supplement' },
];

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [counts, setCounts] = useState({ meals: 0, medsTaken: 0, medDosesScheduled: 0, symptoms: 0, supplements: 0 });
  const [streak, setStreak] = useState(0);

  const refresh = useCallback(() => {
    setCounts(getDayCounts(new Date()));
    setStreak(getStreak());
  }, []);

  useFocusEffect(refresh);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const cards = [
    { label: 'Meals logged', value: String(counts.meals), icon: 'restaurant-outline' as const },
    {
      label: 'Medications',
      value: counts.medDosesScheduled > 0 ? `${counts.medsTaken}/${counts.medDosesScheduled}` : String(counts.medsTaken),
      icon: 'medkit-outline' as const,
    },
    { label: 'Symptoms', value: String(counts.symptoms), icon: 'pulse-outline' as const },
    { label: 'Supplements', value: String(counts.supplements), icon: 'leaf-outline' as const },
  ];

  return (
    <View style={common.screen}>
      <ScrollView contentContainerStyle={common.scroll}>
        <Text style={common.h1}>Today</Text>
        <Text style={common.subtitle}>{todayLabel}</Text>

        <View style={[common.card, styles.streakCard]}>
          <Ionicons name="flame-outline" size={28} color={COLORS.accent} />
          <View style={styles.streakText}>
            <Text style={styles.streakNumber}>{streak} day{streak === 1 ? '' : 's'}</Text>
            <Text style={styles.streakLabel}>logging streak — keep it going</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {cards.map((c) => (
            <View key={c.label} style={[common.card, styles.statCard]}>
              <Ionicons name={c.icon} size={22} color={COLORS.accent} />
              <Text style={styles.statValue}>{c.value}</Text>
              <Text style={styles.statLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        <Text style={[common.h2, { marginTop: 8 }]}>Quick add</Text>
        <View style={styles.quickRow}>
          {QUICK_ADD.map((q) => (
            <TouchableOpacity
              key={q.segment}
              style={styles.quickButton}
              onPress={() => navigation.navigate('Log', { segment: q.segment })}
            >
              <Ionicons name={q.icon} size={24} color="#fff" />
              <Text style={styles.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentLight,
    borderColor: COLORS.accentLight,
  },
  streakText: { marginLeft: 12 },
  streakNumber: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  streakLabel: { fontSize: 13, color: COLORS.muted },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'flex-start',
  },
  statValue: { fontSize: 26, fontWeight: '700', color: COLORS.text, marginTop: 8 },
  statLabel: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickButton: {
    width: '23%',
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickLabel: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
