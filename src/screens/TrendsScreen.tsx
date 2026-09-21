// Trends tab (Pro): weight trend graph + medication/supplement × symptom
// patterns.
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

import React, { useCallback, useMemo, useState } from 'react';
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
import { getItemDayList, getSymptomDayMap, getWeightSeries } from '../db/trends';
import type { ItemDays } from '../db/trends';
import PaywallModal from '../components/PaywallModal';
import Dropdown from '../components/trends/Dropdown';
import PatternChip from '../components/trends/PatternChip';
import SymptomHistoryChart from '../components/trends/SymptomHistoryChart';
import WeightChart from '../components/trends/WeightChart';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';
import {
  MIN_BASELINE_DAYS,
  MIN_COMPARISON_DAYS,
  bucketDays,
  comparePattern,
  diffLabel,
  filterSymptomRange,
  filterWeightRange,
  rankPatterns,
  round1,
  summarizeWeights,
} from '../trendsStats';
import type { RankedPattern, SymptomDay, WeightPoint } from '../trendsStats';

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
    const symptom = names[0] ?? '';
    const item = itemList[0];
    setSelSymptom(symptom);
    setHistSymptom(symptom);
    setSelItemKey(item ? `${item.kind}:${item.name.toLowerCase()}` : '');
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
                Weight trends and medication/supplement × symptom patterns are a Pro
                feature — free users see this upsell instead of the charts.
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
              {symptomNames.length === 0 || items.length === 0 ? (
                <View style={common.card}>
                  <Text style={styles.emptyTitle}>Not enough logs yet</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>
                    Patterns compare your symptom severity on days you took something
                    vs. days you didn't. Log symptoms and medications/supplements on
                    the Log tab to unlock this.
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
                    <Text style={styles.pickerLabel}>Medication or supplement</Text>
                    <View style={styles.chips}>
                      {items.map((it) => {
                        const key = `${it.kind}:${it.name.toLowerCase()}`;
                        return (
                          <PatternChip
                            key={key}
                            selected={selItemKey === key}
                            label={`${it.name} · ${it.kind === 'medication' ? 'Med' : 'Supp'}`}
                            onPress={() => setSelItemKey(key)}
                            a11yLabel={`${it.kind} ${it.name}`}
                          />
                        );
                      })}
                    </View>
                  </View>

                  {selItem && (
                    <View style={common.card}>
                      <Text style={common.h2}>
                        {selSymptom} — on days you logged {selItem.name}
                      </Text>
                      <View style={styles.statRow}>
                        <View style={styles.stat}>
                          <Text style={[styles.statValue, { color: colors.accent }]}>
                            {comparison ? round1(comparison.avgTaken).toFixed(1) : '—'}
                          </Text>
                          <Text style={[styles.statLabel, { color: colors.muted }]}>
                            {`avg severity · days taken (${buckets.taken.length})`}
                          </Text>
                        </View>
                        <View style={styles.stat}>
                          <Text style={[styles.statValue, { color: colors.text }]}>
                            {comparison ? round1(comparison.avgNotTaken).toFixed(1) : '—'}
                          </Text>
                          <Text style={[styles.statLabel, { color: colors.muted }]}>
                            {`avg severity · days not taken (${buckets.notTaken.length})`}
                          </Text>
                        </View>
                      </View>
                      {comparison ? (
                        <Text style={[styles.body, { color: colors.text }]}>
                          {`Severity averaged ${diffLabel(comparison.diff)} — ${comparison.daysTaken} days with vs. ${comparison.daysNotTaken} days without ${selItem.name}, on days you logged ${selSymptom}.`}
                        </Text>
                      ) : (
                        <Text style={[styles.body, { color: colors.muted }]}>
                          {`Not enough data yet — patterns need at least ${MIN_COMPARISON_DAYS} days on each side and ${MIN_BASELINE_DAYS}+ days on one side, on days you logged ${selSymptom}. So far: ${buckets.taken.length} days with, ${buckets.notTaken.length} days without ${selItem.name}.`}
                        </Text>
                      )}
                    </View>
                  )}

                  <Text style={[common.h2, { marginTop: 8 }]}>Strongest patterns</Text>
                  <View style={common.card}>
                    {strongest.length === 0 ? (
                      <Text style={[styles.body, { color: colors.muted }]}>
                        No symptom × item pair has enough data yet — keep logging and
                        check back.
                      </Text>
                    ) : (
                      strongest.map((p) => (
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
    statRow: { flexDirection: 'row', gap: 12, marginBottom: 12, marginTop: 4 },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 28, fontWeight: '700' },
    statLabel: { fontSize: 11, textAlign: 'center', marginTop: 2, lineHeight: 15 },
    patternRow: { marginBottom: 12 },
    patternTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    disclaimer: {
      fontSize: 12,
      color: C.muted,
      marginTop: 8,
      lineHeight: 17,
    },
  });
