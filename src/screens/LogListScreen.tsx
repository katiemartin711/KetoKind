// All-logs screen: every entry of one log type, newest first, grouped by
// day. Reached by tapping a Dashboard stat tile or the weight card. Tap an
// entry to edit it on the Log tab; the ✕ deletes it. Loads in pages so
// multi-year histories don't hitch on open.

import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { deleteLog, getLogsOfKind } from '../db/logs';
import { requestReconcileReminders } from '../reminders';
import { confirmDeleteEntry } from '../confirmDelete';
import { dayKey, dayLabel, fmtTime } from '../datetime';
import type { AnyLog, RootStackParamList } from '../types';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LogList'>;
type LogListRoute = RouteProp<RootStackParamList, 'LogList'>;

const PAGE_SIZE = 100;

const TITLES: Record<AnyLog['kind'], string> = {
  meal: 'Meals',
  medication: 'Medications',
  supplement: 'Supplements',
  symptom: 'Symptoms',
  weight: 'Weigh-ins',
};

const EMPTY_HINTS: Record<AnyLog['kind'], string> = {
  meal: 'No meals logged yet.',
  medication: 'No medications logged yet.',
  supplement: 'No supplements logged yet.',
  symptom: 'No symptoms logged yet.',
  weight: 'No weigh-ins yet.',
};

export default function LogListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<LogListRoute>();
  const { logType } = route.params;
  const { colors: COLORS, common } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [logs, setLogs] = useState<AnyLog[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const refresh = useCallback(() => {
    const page = getLogsOfKind(logType, { limit: PAGE_SIZE, offset: 0 });
    setLogs(page);
    setHasMore(page.length === PAGE_SIZE);
    requestReconcileReminders();
  }, [logType]);

  useFocusEffect(refresh);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    const page = getLogsOfKind(logType, { limit: PAGE_SIZE, offset: logs.length });
    if (page.length === 0) {
      setHasMore(false);
      return;
    }
    setLogs((prev) => [...prev, ...page]);
    setHasMore(page.length === PAGE_SIZE);
  }, [hasMore, logType, logs.length]);

  const sections = useMemo(() => {
    const groups = new Map<string, AnyLog[]>();
    for (const log of logs) {
      const key = dayKey(log.logged_at);
      const list = groups.get(key);
      if (list) list.push(log);
      else groups.set(key, [log]);
    }
    return [...groups.entries()].map(([key, data]) => ({
      title: dayLabel(data[0].logged_at),
      key,
      data,
    }));
  }, [logs]);

  const editEntry = useCallback(
    (log: AnyLog) => {
      navigation.navigate('Tabs', {
        screen: 'Log',
        params: { editEntry: { kind: log.kind, id: log.id } },
      });
    },
    [navigation],
  );

  const confirmDelete = useCallback(
    (log: AnyLog) => {
      confirmDeleteEntry(log.title, () => {
        deleteLog(log.kind, log.id);
        setLogs((prev) => prev.filter((l) => !(l.kind === log.kind && l.id === log.id)));
        requestReconcileReminders();
      });
    },
    [],
  );

  return (
    <SafeAreaView style={common.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
        >
          <Ionicons name="chevron-back-outline" size={26} color={COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{TITLES[logType]}</Text>
        <View style={styles.backBtn} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(log) => `${log.kind}-${log.id}`}
        contentContainerStyle={common.scroll}
        ListEmptyComponent={<Text style={styles.hint}>{EMPTY_HINTS[logType]}</Text>}
        ListHeaderComponent={
          logs.length > 0 ? <Text style={styles.hint}>Tap an entry to edit it.</Text> : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item: log }) => (
          <View style={[common.card, styles.entryRow]}>
            <TouchableOpacity
              style={styles.entryText}
              onPress={() => editEntry(log)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${log.title}`}
            >
              <Text style={styles.entryTitle}>{log.title}</Text>
              <Text style={styles.entryDetail}>
                {fmtTime(log.logged_at)}
                {log.detail ? ` — ${log.detail}` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDelete(log)}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${log.title}`}
            >
              <Text style={styles.deleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingBottom: 4,
    },
    backBtn: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700', color: C.text },
    hint: { fontSize: 14, color: C.muted, marginVertical: 8, paddingHorizontal: 16 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
      marginTop: 14,
      marginBottom: 2,
      paddingHorizontal: 16,
    },
    entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    entryText: { flex: 1 },
    entryTitle: { fontSize: 15, fontWeight: '600', color: C.text },
    entryDetail: { fontSize: 13, color: C.muted, marginTop: 2 },
    deleteBtn: {
      backgroundColor: C.dangerLight,
      borderRadius: 22,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: { color: C.danger, fontSize: 14, fontWeight: '700' },
  });
