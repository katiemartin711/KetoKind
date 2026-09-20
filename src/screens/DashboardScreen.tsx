// Home tab: today's date, stat cards for today, daily streak,
// and quick-add buttons that jump into the Log tab.

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { dismissMilestones, getDayCounts, getDismissedMilestones, getLatestWeight, getProfile, getStreak } from '../db';
import type { LogSegment, RootTabParamList } from '../types';
import { DIET_LABELS } from '../types';
import { currentMilestone, reachedMilestones } from '../milestones';
import type { Milestone } from '../milestones';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';

type Nav = BottomTabNavigationProp<RootTabParamList>;

const QUICK_ADD: { label: string; icon: keyof typeof Ionicons.glyphMap; segment: LogSegment }[] = [
  { label: 'Meal', icon: 'restaurant-outline', segment: 'meal' },
  { label: 'Meds', icon: 'medkit-outline', segment: 'medsupp' },
  { label: 'Symptom', icon: 'pulse-outline', segment: 'symptom' },
];

/** "+2.5 lbs" / "-1 lbs" / "no change" vs the starting weight. */
function fmtWeightChange(latest: number, starting: number): string {
  const d = Math.round((latest - starting) * 10) / 10;
  if (d === 0) return 'no change since start';
  return `${d > 0 ? '+' : ''}${d} lbs since start`;
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { colors: COLORS, common } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [counts, setCounts] = useState({ meals: 0, medsTaken: 0, medDosesScheduled: 0, symptoms: 0, supplements: 0 });
  const [streak, setStreak] = useState(0);
  const [weightCard, setWeightCard] = useState<{ latest: number | null; starting: number | null } | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [dietLabel, setDietLabel] = useState('');

  const refresh = useCallback(() => {
    setCounts(getDayCounts(new Date()));
    setStreak(getStreak());
    const p = getProfile();
    setDietLabel(DIET_LABELS[p.diet_type]);
    setMilestone(currentMilestone(p.diet_start, getDismissedMilestones()));
    if (p.track_weight) {
      const latest = getLatestWeight();
      setWeightCard({ latest: latest?.weight ?? null, starting: p.starting_weight });
    } else {
      setWeightCard(null);
    }
  }, []);

  const dismissBanner = useCallback(() => {
    const p = getProfile();
    dismissMilestones(reachedMilestones(p.diet_start).map((m) => m.key));
    setMilestone(null);
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

        {milestone && (
          <View style={[common.card, styles.milestoneCard]}>
            <Ionicons name="trophy-outline" size={30} color={COLORS.accent} />
            <View style={styles.milestoneText}>
              <Text style={styles.milestoneTitle}>🎉 {milestone.label}!</Text>
              <Text style={styles.milestoneSub}>
                {milestone.label} on {dietLabel} — incredible consistency. Keep going!
              </Text>
            </View>
            <TouchableOpacity onPress={dismissBanner} style={styles.milestoneClose} hitSlop={12}>
              <Ionicons name="close-outline" size={20} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
        )}

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

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    streakCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.accentLight,
      borderColor: C.accentLight,
    },
    streakText: { marginLeft: 12 },
    streakNumber: { fontSize: 20, fontWeight: '700', color: C.text },
    streakLabel: { fontSize: 13, color: C.muted },
    milestoneCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.accentLight,
      borderColor: C.accentLight,
    },
    milestoneText: { flex: 1, marginLeft: 12 },
    milestoneTitle: { fontSize: 20, fontWeight: '700', color: C.text },
    milestoneSub: { fontSize: 13, color: C.muted, marginTop: 2 },
    milestoneClose: { padding: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    alignItems: 'flex-start',
  },
  statValue: { fontSize: 26, fontWeight: '700', color: C.text, marginTop: 8 },
  statLabel: { fontSize: 13, color: C.muted, marginTop: 2 },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickButton: {
    backgroundColor: C.accent,
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
  weightTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  weightDetail: { fontSize: 14, color: C.muted, marginTop: 4 },
  weightButton: {
    backgroundColor: C.accentLight,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  weightButtonText: { color: C.accent, fontWeight: '700', fontSize: 14 },
  });
