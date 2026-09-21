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

import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import {
  getItemDayList,
  getProStatus,
  getSymptomDayMap,
  getWeightSeries,
} from '../db';
import type { ItemDays } from '../db';
import PaywallModal from '../components/PaywallModal';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';
import {
  MIN_PATTERN_DAYS,
  bucketDays,
  comparePattern,
  filterWeightRange,
  rankPatterns,
  round1,
  shortDayLabel,
  summarizeWeights,
} from '../trendsStats';
import type { RankedPattern, SymptomDay, WeightPoint } from '../trendsStats';

type RangeKey = 30 | 90 | -1;
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
  { key: -1, label: 'All' },
];

/** Hand-rolled SVG line chart (react-native-svg ships in Expo Go, so this
 *  adds no native risk — unlike chart libraries that need extra native
 *  modules). Min/max/current points are marked; themed via the palette. */
function WeightChart({ points, colors }: { points: WeightPoint[]; colors: Palette }) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(280, windowWidth - 64);
  const height = 190;
  const pad = { left: 12, right: 12, top: 20, bottom: 26 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const weights = points.map((p) => p.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const n = points.length;
  const x = (i: number) => pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * innerH;

  const linePts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ');
  const areaPts =
    `${pad.left},${(pad.top + innerH).toFixed(1)} ` +
    linePts +
    ` ${(pad.left + innerW).toFixed(1)},${(pad.top + innerH).toFixed(1)}`;

  const minIdx = weights.indexOf(Math.min(...weights));
  const maxIdx = weights.indexOf(Math.max(...weights));
  const lastIdx = n - 1;

  return (
    <View>
      <Svg width={width} height={height} accessibilityRole="image" accessibilityLabel="Weight trend graph">
        <Polygon points={areaPts} fill={colors.accent} opacity={0.12} />
        <Polyline points={linePts} fill="none" stroke={colors.accent} strokeWidth={2.5} />
        {points.map((p, i) => (
          <Circle key={i} cx={x(i)} cy={y(p.weight)} r={3} fill={colors.accent} />
        ))}
        {/* min / max markers */}
        <Circle cx={x(minIdx)} cy={y(weights[minIdx])} r={5} fill="none" stroke={colors.muted} strokeWidth={2} />
        <SvgText
          x={x(minIdx)}
          y={y(weights[minIdx]) - 10}
          fontSize={10}
          fill={colors.muted}
          textAnchor="middle"
        >
          {`low ${round1(weights[minIdx])}`}
        </SvgText>
        <Circle cx={x(maxIdx)} cy={y(weights[maxIdx])} r={5} fill="none" stroke={colors.muted} strokeWidth={2} />
        <SvgText
          x={x(maxIdx)}
          y={y(weights[maxIdx]) - 10}
          fontSize={10}
          fill={colors.muted}
          textAnchor="middle"
        >
          {`high ${round1(weights[maxIdx])}`}
        </SvgText>
        {/* current marker */}
        <Circle cx={x(lastIdx)} cy={y(weights[lastIdx])} r={5.5} fill={colors.accent} />
        <SvgText
          x={x(lastIdx)}
          y={y(weights[lastIdx]) + 18}
          fontSize={11}
          fontWeight="700"
          fill={colors.text}
          textAnchor="middle"
        >
          {round1(weights[lastIdx])}
        </SvgText>
        {/* x-axis day labels */}
        <SvgText x={pad.left} y={height - 8} fontSize={10} fill={colors.muted}>
          {shortDayLabel(points[0].day)}
        </SvgText>
        {n > 1 && (
          <SvgText
            x={pad.left + innerW}
            y={height - 8}
            fontSize={10}
            fill={colors.muted}
            textAnchor="end"
          >
            {shortDayLabel(points[lastIdx].day)}
          </SvgText>
        )}
      </Svg>
    </View>
  );
}

/** "0.8 lower on days taken" / "1.2 higher on days taken" — describes the
 *  pattern in the logs without implying cause. */
function diffLabel(diff: number): string {
  const v = round1(Math.abs(diff));
  if (v === 0) return 'about the same on days taken vs. not taken';
  return `${v} ${diff < 0 ? 'lower' : 'higher'} on days taken`;
}

export default function TrendsScreen() {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const [weightSeries, setWeightSeries] = useState<WeightPoint[]>([]);
  const [range, setRange] = useState<RangeKey>(90);
  const [symptomNames, setSymptomNames] = useState<string[]>([]);
  const [symptomDayMap, setSymptomDayMap] = useState<Map<string, SymptomDay[]>>(new Map());
  const [items, setItems] = useState<ItemDays[]>([]);
  const [selSymptom, setSelSymptom] = useState<string>('');
  const [selItemKey, setSelItemKey] = useState<string>('');
  const [strongest, setStrongest] = useState<RankedPattern[]>([]);

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

  const chip = (selected: boolean, label: string, onPress: () => void, a11y: string) => (
    <TouchableOpacity
      key={`${a11y}-${label}`}
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ selected }}
      accessibilityLabel={a11y}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
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
                  <View style={styles.chips}>
                    {RANGES.map((r) => chip(range === r.key, r.label, () => setRange(r.key), `Weight range ${r.label}`))}
                  </View>
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
                      {symptomNames.map((s) => chip(selSymptom === s, s, () => setSelSymptom(s), `Symptom ${s}`))}
                    </View>
                    <Text style={styles.pickerLabel}>Medication or supplement</Text>
                    <View style={styles.chips}>
                      {items.map((it) =>
                        chip(
                          selItemKey === `${it.kind}:${it.name.toLowerCase()}`,
                          `${it.name} · ${it.kind === 'medication' ? 'Med' : 'Supp'}`,
                          () => setSelItemKey(`${it.kind}:${it.name.toLowerCase()}`),
                          `${it.kind} ${it.name}`,
                        ),
                      )}
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
                          {`Not enough data yet — patterns need at least ${MIN_PATTERN_DAYS} days with and ${MIN_PATTERN_DAYS} days without ${selItem.name}, on days you logged ${selSymptom}. So far: ${buckets.taken.length} days with, ${buckets.notTaken.length} days without.`}
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
    chip: {
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: C.input,
      marginBottom: 4,
    },
    chipActive: { backgroundColor: C.accent, borderColor: C.accent },
    chipText: { fontSize: 14, color: C.text },
    chipTextActive: { color: '#fff', fontWeight: '600' },
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
