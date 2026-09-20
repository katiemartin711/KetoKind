// Home tab: today's date, stat cards for today, daily streak,
// and quick-add buttons that jump into the Log tab.

import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { getDayCounts, getLatestWeight, getProfile, getStreak } from '../db';
import type { LogSegment, RootTabParamList } from '../types';
import { COLORS, common } from '../theme';

type Nav = BottomTabNavigationProp<RootTabParamList>;

const QUICK_ADD: { label: string; icon: keyof typeof Ionicons.glyphMap; segment: LogSegment }[] = [
  { label: 'Meal', icon: 'restaurant-outline', segment: 'meal' },
  { label: 'Med', icon: 'medkit-outline', segment: 'medication' },
  { label: 'Symptom', icon: 'pulse-outline', segment: 'symptom' },
  { label: 'Supplement', icon: 'leaf-outline', segment: 'supplement' },
];

/** "+2.5 lbs" / "-1 lbs" / "no change" vs the starting weight. */
function fmtWeightChange(latest: number, starting: number): string {
  const d = Math.round((latest - starting) * 10) / 10;
  if (d === 0) return 'no change since start';
  return `${d > 0 ? '+' : ''}${d} lbs since start`;
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [counts, setCounts] = useState({ meals: 0, medsTaken: 0, medDosesScheduled: 0, symptoms: 0, supplements: 0 });
  const [streak, setStreak] = useState(0);
  const [weightCard, setWeightCard] = useState<{ latest: number | null; starting: number | null } | null>(null);

  const refresh = useCallback(() => {
    setCounts(getDayCounts(new Date()));
    setStreak(getStreak());
    const p = getProfile();
    if (p.track_weight) {
      const latest = getLatestWeight();
      setWeightCard({ latest: latest?.weight ?? null, starting: p.starting_weight });
    } else {
      setWeightCard(null);
    }
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

  // Weight appears as a fifth quick-add button only while tracking is on.
  const quickAdd: typeof QUICK_ADD = weightCard
    ? [...QUICK_ADD, { label: 'Weight', icon: 'scale-outline', segment: 'weight' }]
    : QUICK_ADD;

  return (
    <SafeAreaView style={common.screen} edges={['top']}>
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
          {quickAdd.map((q) => (
            <TouchableOpacity
              key={q.segment}
              style={[styles.quickButton, { width: `${Math.floor(92 / quickAdd.length)}%` }]}
              onPress={() => navigation.navigate('Log', { segment: q.segment })}
            >
              <Ionicons name={q.icon} size={24} color="#fff" />
              <Text style={styles.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {weightCard && (
          <View style={[common.card, styles.weightCard]}>
            <View style={styles.weightText}>
              <Text style={styles.weightTitle}>Weight</Text>
              <Text style={styles.weightDetail}>
                {weightCard.latest != null
                  ? `Latest: ${weightCard.latest} lbs`
                  : 'No weigh-ins yet'}
                {weightCard.starting != null && ` · Started at ${weightCard.starting} lbs`}
                {weightCard.latest != null &&
                  weightCard.starting != null &&
                  ` (${fmtWeightChange(weightCard.latest, weightCard.starting)})`}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.weightButton}
              onPress={() => navigation.navigate('Log', { segment: 'weight' })}
            >
              <Text style={styles.weightButtonText}>Log weight</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickLabel: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 },
  weightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  weightText: { flex: 1 },
  weightTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  weightDetail: { fontSize: 14, color: COLORS.muted, marginTop: 4 },
  weightButton: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  weightButtonText: { color: COLORS.accent, fontWeight: '700', fontSize: 14 },
});
