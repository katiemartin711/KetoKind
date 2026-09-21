// Trends tab (Pro): weight trend graph + symptom patterns across
// medications, supplements, and foods (plain-English meal text matching).
//
// PRO GATING (same pattern as the AI Coach tab): refresh() checks
// getProStatus() first and returns before any query for free users — the
// underlying data is never loaded for them. Free users see the Pro upsell
// card and get the PaywallModal.
//
// Copy discipline (App Store safety): everything is framed as "patterns in
// your logs" — never causal, and nothing here suggests starting, stopping,
// or changing any medication. The disclaimer at the bottom says so plainly.
//
// The tab is composed of focused components (src/components/trends/);
// this file owns the state and the db-backed refresh.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProStatus } from '../db/profile';
import { getItemDayList, getMealDayMap, getSymptomDayMap, getWeightSeries } from '../db/trends';
import type { ItemDays } from '../db/trends';
import PaywallModal from '../components/PaywallModal';
import Dropdown from '../components/trends/Dropdown';
import FoodSearchInput from '../components/trends/FoodSearchInput';
import PatternChip from '../components/trends/PatternChip';
import PatternDetailCard from '../components/trends/PatternDetailCard';
import SymptomHistoryChart from '../components/trends/SymptomHistoryChart';
import WeightChart from '../components/trends/WeightChart';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';
import { matchFoodDays } from '../foodGroups';
import {
  bucketDays,
  comparePattern,
  diffLabel,
  filterSymptomRange,
  filterWeightRange,
  rankPatterns,
  round1,
  summarizeWeights,
} from '../trendsStats';
import type { PatternComparison, RankedPattern, SymptomDay, WeightPoint } from '../trendsStats';

/** Shared range options for the weight trend and symptom history charts. */
const TREND_RANGES: { key: number; label: string }[] = [
  { key: 7, label: 'Week' },
  { key: 30, label: 'Month' },
  { key: 90, label: '90 days' },
  { key: 180, label: '6 months' },
  { key: 365, label: 'Year' },
  { key: -1, label: 'All' },
];

export default function TrendsScreen() {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const [weightSeries, setWeightSeries] = useState<WeightPoint[]>([]);
  const [range, setRange] = useState<number>(90);
  const [symptomNames, setSymptomNames] = useState<string[]>([]);
  const [symptomDayMap, setSymptomDayMap] = useState<Map<string, SymptomDay[]>>(new Map());
  const [items, setItems] = useState<ItemDays[]>([]);
  const [selSymptom, setSelSymptom] = useState<string>('');
  const [selItemKey, setSelItemKey] = useState<string>('');
  const [strongest, setStrongest] = useState<RankedPattern[]>([]);
  const [itemMode, setItemMode] = useState<'medication' | 'supplement' | 'food' | null>(null);
  const [foodInput, setFoodInput] = useState('');
  const [foodKeyword, setFoodKeyword] = useState('');
  const [mealDayMap, setMealDayMap] = useState<Map<string, string[]>>(new Map());
  const [histSymptom, setHistSymptom] = useState<string>('');
  const [histRange, setHistRange] = useState<number>(90);

  const refresh = useCallback(() => {
    const pro = getProStatus();
    setIsPro(pro);
    if (!pro) return; // free users see the Pro upsell — data is never loaded
    const series = getWeightSeries();
    setWeightSeries(series);
    const sMap = getSymptomDayMap();
    const names = [...sMap.keys()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
    setSymptomDayMap(sMap);
    setSymptomNames(names);
    const itemList = getItemDayList();
    setItems(itemList);
    setMealDayMap(getMealDayMap());
    const symptom = names[0] ?? '';
    const firstItem =
      itemList.find((i) => i.kind === 'medication') ?? itemList[0];
    setSelSymptom(symptom);
    setHistSymptom(symptom);
    setSelItemKey(firstItem ? `${firstItem.kind}:${firstItem.name.toLowerCase()}` : '');
    // Strongest patterns across every symptom × item pair.
    const all = [];
    for (const sName of names) {
      const sDays = sMap.get(sName) ?? [];
      for (const it of itemList) {
        all.push(comparePattern(sName, sDays, it.name, it.kind, it.days));
      }
    }
    setStrongest(rankPatterns(all, 3));
  }, []);

  useFocusEffect(refresh);

  // Debounce the food keyword so the pattern recomputes ~300ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setFoodKeyword(foodInput.trim()), 300);
    return () => clearTimeout(t);
  }, [foodInput]);

  const filteredWeights = useMemo(() => filterWeightRange(weightSeries, range), [weightSeries, range]);
  const weightSummary = useMemo(() => summarizeWeights(filteredWeights), [filteredWeights]);

  const selItem = useMemo(
    () => items.find((it) => `${it.kind}:${it.name.toLowerCase()}` === selItemKey) ?? null,
    [items, selItemKey],
  );
  const selSymptomDays = useMemo(() => symptomDayMap.get(selSymptom) ?? [], [symptomDayMap, selSymptom]);
  const comparison = useMemo(() => {
    if (!selSymptom || !selItem || selSymptomDays.length === 0) return null;
    return comparePattern(selSymptom, selSymptomDays, selItem.name, selItem.kind, selItem.days);
  }, [selSymptom, selSymptomDays, selItem]);
  const buckets = useMemo(
    () => (selItem ? bucketDays(selSymptomDays, selItem.days) : { taken: [], notTaken: [] }),
    [selSymptomDays, selItem],
  );
  const medItems = useMemo(() => items.filter((it) => it.kind === 'medication'), [items]);
  const suppItems = useMemo(() => items.filter((it) => it.kind === 'supplement'), [items]);
  // Default tab prefers the first kind with data; the user's pick wins after that.
  const mode = useMemo<'medication' | 'supplement' | 'food'>(() => {
    if (itemMode) return itemMode;
    if (medItems.length > 0) return 'medication';
    if (suppItems.length > 0) return 'supplement';
    return 'food';
  }, [itemMode, medItems, suppItems]);
  const foodMatch = useMemo(
    () => (foodKeyword ? matchFoodDays(foodKeyword, mealDayMap) : null),
    [foodKeyword, mealDayMap],
  );
  const foodComparison = useMemo(() => {
    if (!selSymptom || !foodMatch || selSymptomDays.length === 0) return null;
    return comparePattern(selSymptom, selSymptomDays, foodKeyword, 'food', foodMatch.daysWith);
  }, [selSymptom, selSymptomDays, foodMatch, foodKeyword]);
  const foodBuckets = useMemo(
    () =>
      foodMatch ? bucketDays(selSymptomDays, foodMatch.daysWith) : { taken: [], notTaken: [] },
    [selSymptomDays, foodMatch],
  );
  const foodHint = foodMatch?.isGroup ? `matching: ${foodMatch.matchedFoods.join(', ')}…` : null;
  // The typed food joins the top-3 strongest patterns alongside med/supplement pairs.
  const strongestWithFood = useMemo(() => {
    if (!foodMatch) return strongest;
    const extra: (PatternComparison | null)[] = [];
    for (const sName of symptomNames) {
      extra.push(
        comparePattern(
          sName,
          symptomDayMap.get(sName) ?? [],
          foodKeyword,
          'food',
          foodMatch.daysWith,
        ),
      );
    }
    return rankPatterns([...strongest, ...extra], 3);
  }, [strongest, foodMatch, foodKeyword, symptomNames, symptomDayMap]);
  const histAllDays = useMemo(
    () => symptomDayMap.get(histSymptom) ?? [],
    [symptomDayMap, histSymptom],
  );
  const histDays = useMemo(
    () => filterSymptomRange(histAllDays, histRange),
    [histAllDays, histRange],
  );
  const histAvg = useMemo(
    () =>
      histDays.length === 0
        ? 0
        : histDays.reduce((a, d) => a + d.severity, 0) / histDays.length,
    [histDays],
  );

  return (
    <>
      <SafeAreaView style={common.screen} edges={['top']}>
        <ScrollView contentContainerStyle={common.scroll}>
          <Text style={common.h1}>Trends</Text>
          {!isPro ? (
            <View style={common.card}>
              <Text style={common.h2}>KetoKind Pro</Text>
              <Text style={common.subtitle}>
                Weight trends and symptom patterns (medications, supplements, and
                foods) are a Pro feature — free users see this upsell instead of
                the charts.
              </Text>
              <TouchableOpacity
                style={common.primaryButton}
                onPress={() => setPaywallVisible(true)}
                accessibilityRole="button"
              >
                <Text style={common.primaryButtonText}>See KetoKind Pro — $9.99</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={common.h2}>Weight trend</Text>
              {weightSeries.length === 0 ? (
                <View style={common.card}>
                  <Text style={styles.emptyTitle}>No weigh-ins yet</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    Weight logging is optional. Add a weigh-in on the Log tab and
                    your trend will appear here.
                  </Text>
                </View>
              ) : (
                <View style={common.card}>
                  <Dropdown
                    value={range}
                    options={TREND_RANGES}
                    onChange={setRange}
                    a11yLabel="Weight range"
                  />
                  {filteredWeights.length === 0 ? (
                    <Text style={[styles.body, { color: colors.muted, marginTop: 12 }]}>
                      No weigh-ins in this range — try a longer one.
                    </Text>
                  ) : (
                    <>
                      {weightSummary && (
                        <Text style={[styles.summary, { color: colors.text }]}>
                          {`Current ${round1(weightSummary.current)} lbs · low ${round1(weightSummary.min)} · high ${round1(weightSummary.max)}`}
                          {weightSummary.change !== 0 &&
                            ` · ${weightSummary.change < 0 ? '−' : '+'}${round1(Math.abs(weightSummary.change))} in range`}
                        </Text>
                      )}
                      <WeightChart points={filteredWeights} colors={colors} />
                    </>
                  )}
                </View>
              )}

              <Text style={[common.h2, { marginTop: 8 }]}>Symptom patterns</Text>
              {symptomNames.length === 0 || (items.length === 0 && mealDayMap.size === 0) ? (
                <View style={common.card}>
                  <Text style={styles.emptyTitle}>Not enough logs yet</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    Patterns compare your symptom severity on days you logged
                    something vs. days you didn't. Log symptoms, meals, and
                    medications/supplements on the Log tab to unlock this.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={common.card}>
                    <Text style={styles.pickerLabel}>Symptom</Text>
                    <View style={styles.chips}>
                      {symptomNames.map((s) => (
                        <PatternChip
                          key={s}
                          selected={selSymptom === s}
                          label={s}
                          onPress={() => setSelSymptom(s)}
                          a11yLabel={`Symptom ${s}`}
                        />
                      ))}
                    </View>
                    <Text style={styles.pickerLabel}>Compare with</Text>
                    <View style={styles.chips}>
                      <PatternChip
                        selected={mode === 'medication'}
                        label="Medications"
                        onPress={() => setItemMode('medication')}
                        a11yLabel="Compare with medications"
                      />
                      <PatternChip
                        selected={mode === 'supplement'}
                        label="Supplements"
                        onPress={() => setItemMode('supplement')}
                        a11yLabel="Compare with supplements"
                      />
                      <PatternChip
                        selected={mode === 'food'}
                        label="Food"
                        onPress={() => setItemMode('food')}
                        a11yLabel="Compare with foods"
                      />
                    </View>
                    {mode === 'food' ? (
                      <>
                        <FoodSearchInput
                          value={foodInput}
                          onChange={setFoodInput}
                          matchHint={foodHint}
                        />
                        {mealDayMap.size === 0 && (
                          <Text style={[styles.body, { color: colors.muted, marginTop: 6 }]}>
                            No meals logged yet — add meals on the Log tab, then type a
                            food above.
                          </Text>
                        )}
                      </>
                    ) : (
                      <View style={styles.chips}>
                        {(mode === 'medication' ? medItems : suppItems).map((it) => {
                          const key = `${it.kind}:${it.name.toLowerCase()}`;
                          return (
                            <PatternChip
                              key={key}
                              selected={selItemKey === key}
                              label={it.name}
                              onPress={() => setSelItemKey(key)}
                              a11yLabel={`${it.kind} ${it.name}`}
                            />
                          );
                        })}
                        {(mode === 'medication' ? medItems : suppItems).length === 0 && (
                          <Text style={[styles.body, { color: colors.muted }]}>
                            {mode === 'medication'
                              ? 'No medications logged yet — log some on the Log tab, or try the Food tab.'
                              : 'No supplements logged yet — log some on the Log tab, or try the Food tab.'}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {mode !== 'food' && selItem && selItem.kind === mode && (
                    <PatternDetailCard
                      symptomName={selSymptom}
                      itemLabel={selItem.name}
                      onDaysWord="taken"
                      comparison={comparison}
                      buckets={buckets}
                    />
                  )}
                  {mode === 'food' && foodKeyword === '' && (
                    <View style={common.card}>
                      <Text style={[styles.body, { color: colors.muted }]}>
                        {`Type a food above — e.g. eggs or dairy — to compare your ${selSymptom || 'symptom'} severity on days you logged it vs. days you didn't.`}
                      </Text>
                    </View>
                  )}
                  {mode === 'food' && foodKeyword !== '' && (
                    <PatternDetailCard
                      symptomName={selSymptom}
                      itemLabel={foodKeyword}
                      onDaysWord="logged"
                      comparison={foodComparison}
                      buckets={foodBuckets}
                    />
                  )}

                  <Text style={[common.h2, { marginTop: 8 }]}>Strongest patterns</Text>
                  <View style={common.card}>
                    {strongestWithFood.length === 0 ? (
                      <Text style={[styles.body, { color: colors.muted }]}>
                        No symptom × item pair has enough data yet — keep logging and
                        check back.
                      </Text>
                    ) : (
                      strongestWithFood.map((p) => (
                        <View key={`${p.symptomName}|${p.itemKind}|${p.itemName}`} style={styles.patternRow}>
                          <Text style={[styles.patternTitle, { color: colors.text }]}>
                            {`${p.symptomName} × ${p.itemName}`}
                          </Text>
                          <Text style={[styles.body, { color: colors.muted }]}>
                            {`Severity averaged ${diffLabel(p.diff)} (${p.daysTaken} vs. ${p.daysNotTaken} days)`}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </>
              )}

              {symptomNames.length > 0 && (
                <>
                  <Text style={[common.h2, { marginTop: 8 }]}>Symptom over time</Text>
                  <View style={common.card}>
                    <Text style={styles.pickerLabel}>Symptom</Text>
                    <View style={styles.chips}>
                      {symptomNames.map((s) => (
                        <PatternChip
                          key={s}
                          selected={histSymptom === s}
                          label={s}
                          onPress={() => setHistSymptom(s)}
                          a11yLabel={`History symptom ${s}`}
                        />
                      ))}
                    </View>
                    <Dropdown
                      value={histRange}
                      options={TREND_RANGES}
                      onChange={setHistRange}
                      a11yLabel="Symptom history range"
                    />
                    {histAllDays.length === 0 ? (
                      <Text style={[styles.body, { color: colors.muted, marginTop: 8 }]}>
                        No logs for this symptom yet.
                      </Text>
                    ) : histDays.length === 0 ? (
                      <Text style={[styles.body, { color: colors.muted, marginTop: 8 }]}>
                        No logs in this range — try a longer one.
                      </Text>
                    ) : (
                      <>
                        <Text style={[styles.summary, { color: colors.text }]}>
                          {`Logged ${histDays.length} ${histDays.length === 1 ? 'day' : 'days'} · avg severity ${round1(histAvg).toFixed(1)} · worst ${round1(Math.max(...histDays.map((d) => d.severity))).toFixed(0)}`}
                        </Text>
                        <SymptomHistoryChart days={histDays} colors={colors} />
                        <Text style={[styles.body, { color: colors.muted, marginTop: 4 }]}>
                          Each dot is a day you logged {histSymptom || 'this symptom'} — higher means more severe (1–5).
                        </Text>
                      </>
                    )}
                  </View>
                </>
              )}

              <Text style={styles.disclaimer}>
                Patterns, not medical advice. Talk to your doctor about any medication
                changes.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUnlocked={refresh}
      />
    </>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    pickerLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: C.muted,
      marginTop: 10,
      marginBottom: 8,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 20 },
    summary: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 10 },
    patternRow: { marginBottom: 12 },
    patternTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    disclaimer: {
      fontSize: 12,
      color: C.muted,
      marginTop: 8,
      lineHeight: 17,
    },
  });
