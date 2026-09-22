// Reminders settings card on the Profile tab: the daily log nudge
// (default 8pm, only when nothing was logged), extra custom reminders,
// sound/badge toggles, and a shortcut to the iPhone's system notification
// settings (banner style, banner duration, per-app toggles live there).

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../ThemeContext';
import type { Palette } from '../../theme';
import {
  formatTime,
  newCustomReminderId,
  type ReminderSettings,
  type ReminderTime,
} from '../../reminderLogic';
import { getReminderSettings, saveReminderSettings } from '../../db/profile';
import {
  ensureNotificationPermission,
  getNotificationPermission,
  reconcileReminders,
} from '../../reminders';
import TimePickerModal from './TimePickerModal';

type Permission = 'granted' | 'denied' | 'undetermined';
type PickerState = { mode: 'main' } | { mode: 'custom'; id: string } | { mode: 'new' } | null;

function SettingRow({
  label,
  hint,
  value,
  onToggle,
  C,
  styles,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  C: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: C.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: C.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: C.accent, false: C.border }}
        accessibilityRole="switch"
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function NotificationSection() {
  const { colors: C, common } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [settings, setSettings] = useState<ReminderSettings>(() => getReminderSettings());
  const [permission, setPermission] = useState<Permission>('undetermined');
  const [picker, setPicker] = useState<PickerState>(null);

  const refresh = useCallback(() => {
    try {
      setSettings(getReminderSettings());
    } catch {
      // DB hiccup: keep showing the last-known settings.
    }
    getNotificationPermission().then(setPermission).catch(() => {});
  }, []);

  // Re-read when returning to the Profile tab — the user may have flipped
  // the system switch in iPhone Settings while we were away.
  useFocusEffect(refresh);

  /** Persist one change and re-schedule. Never throws: a scheduling failure
   *  must not lose the user's saved preference. */
  const apply = useCallback(
    (next: ReminderSettings) => {
      setSettings(next);
      try {
        saveReminderSettings(next);
      } catch {
        return;
      }
      reconcileReminders();
    },
    [],
  );

  const toggleEnabled = async (v: boolean) => {
    if (v) {
      const ok = await ensureNotificationPermission();
      setPermission(await getNotificationPermission().catch(() => 'undetermined' as Permission));
      if (!ok) {
        Alert.alert(
          'Notifications are blocked',
          'KetoKind needs notification permission to send reminders. You can allow it in iPhone Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    apply({ ...settings, enabled: v });
  };

  const onPickerSave = (t: ReminderTime) => {
    if (picker?.mode === 'main') {
      apply({ ...settings, time: t });
    } else if (picker?.mode === 'custom') {
      apply({
        ...settings,
        custom: settings.custom.map((c) => (c.id === picker.id ? { ...c, hour: t.hour, minute: t.minute } : c)),
      });
    } else if (picker?.mode === 'new') {
      apply({
        ...settings,
        custom: [...settings.custom, { id: newCustomReminderId(), hour: t.hour, minute: t.minute }],
      });
    }
    setPicker(null);
  };

  const deleteCustom = (id: string) => {
    apply({ ...settings, custom: settings.custom.filter((c) => c.id !== id) });
  };

  const pickerInitial: ReminderTime =
    picker?.mode === 'custom'
      ? settings.custom.find((c) => c.id === picker.id) ?? settings.time
      : settings.time;

  return (
    <View style={common.card}>
      <Text style={common.h2}>Reminders</Text>
      <Text style={[styles.topHint, { color: C.muted }]}>
        Gentle nudges to log, sent from this phone — nothing leaves your device.
      </Text>

      {permission === 'denied' ? (
        <View style={[styles.warn, { backgroundColor: C.dangerLight }]}>
          <Text style={[styles.warnText, { color: C.danger }]}>
            Notifications are blocked for KetoKind, so reminders can't fire.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={[styles.warnButton, { borderColor: C.danger }]}
            accessibilityRole="button"
            accessibilityLabel="Open iPhone Settings"
          >
            <Text style={[styles.warnButtonText, { color: C.danger }]}>Open iPhone Settings</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {permission === 'undetermined' && settings.enabled ? (
        <TouchableOpacity
          onPress={async () => {
            const ok = await ensureNotificationPermission();
            setPermission(await getNotificationPermission().catch(() => 'undetermined' as Permission));
            if (ok) reconcileReminders();
          }}
          style={[styles.allowButton, { backgroundColor: C.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Allow notifications"
        >
          <Text style={styles.allowButtonText}>Allow notifications</Text>
        </TouchableOpacity>
      ) : null}

      <SettingRow
        label="Daily log reminder"
        hint={`${formatTime(settings.time)} · ${settings.onlyIfNoLogs ? 'only if you haven’t logged today' : 'every day'}`}
        value={settings.enabled}
        onToggle={toggleEnabled}
        C={C}
        styles={styles}
      />

      <TouchableOpacity
        onPress={() => setPicker({ mode: 'main' })}
        style={styles.timeRow}
        accessibilityRole="button"
        accessibilityLabel={`Reminder time, currently ${formatTime(settings.time)}`}
      >
        <Text style={[styles.label, { color: C.text }]}>Reminder time</Text>
        <Text style={[styles.timeValue, { color: C.accent }]}>{formatTime(settings.time)}</Text>
      </TouchableOpacity>

      <SettingRow
        label="Only remind me if I haven’t logged"
        hint="Skips the nudge on days you already logged anything"
        value={settings.onlyIfNoLogs}
        onToggle={(v) => apply({ ...settings, onlyIfNoLogs: v })}
        C={C}
        styles={styles}
      />

      <SettingRow
        label="Sound"
        value={settings.sound}
        onToggle={(v) => apply({ ...settings, sound: v })}
        C={C}
        styles={styles}
      />

      <SettingRow
        label="App icon badge"
        hint="Shows a badge on the KetoKind icon when a reminder fires"
        value={settings.badge}
        onToggle={(v) => apply({ ...settings, badge: v })}
        C={C}
        styles={styles}
      />

      <Text style={[styles.sectionLabel, { color: C.muted }]}>EXTRA REMINDERS</Text>
      {settings.custom
        .slice()
        .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
        .map((c) => (
          <View key={c.id} style={styles.customRow}>
            <TouchableOpacity
              onPress={() => setPicker({ mode: 'custom', id: c.id })}
              style={styles.customTime}
              accessibilityRole="button"
              accessibilityLabel={`Edit reminder, currently ${formatTime(c)}`}
            >
              <Text style={[styles.timeValue, { color: C.text }]}>{formatTime(c)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteCustom(c.id)}
              style={[styles.delete, { backgroundColor: C.dangerLight }]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${formatTime(c)} reminder`}
            >
              <Text style={[styles.deleteText, { color: C.danger }]}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      <TouchableOpacity
        onPress={() => setPicker({ mode: 'new' })}
        style={[styles.addButton, { borderColor: C.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Add reminder"
      >
        <Text style={[styles.addButtonText, { color: C.accent }]}>+ Add reminder</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionLabel, { color: C.muted }]}>NOTIFICATION STYLE</Text>
      <Text style={[styles.hint, { color: C.muted, marginBottom: 8 }]}>
        Banner vs. list, how long banners stay on screen, and sounds are controlled in iPhone Settings.
      </Text>
      <TouchableOpacity
        onPress={() => Linking.openSettings()}
        style={[styles.addButton, { borderColor: C.border }]}
        accessibilityRole="button"
        accessibilityLabel="Open iPhone Settings"
      >
        <Text style={[styles.addButtonText, { color: C.text }]}>Open iPhone Settings</Text>
      </TouchableOpacity>

      <TimePickerModal
        visible={picker !== null}
        title={
          picker?.mode === 'main'
            ? 'Daily reminder time'
            : picker?.mode === 'custom'
              ? 'Edit reminder'
              : 'Add reminder'
        }
        initial={pickerInitial}
        onClose={() => setPicker(null)}
        onSave={onPickerSave}
      />
    </View>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    topHint: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
    warn: { borderRadius: 10, padding: 12, marginBottom: 12 },
    warnText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
    warnButton: {
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    warnButtonText: { fontSize: 15, fontWeight: '600' },
    allowButton: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
    allowButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    rowText: { flex: 1, marginRight: 8 },
    label: { fontSize: 16 },
    hint: { fontSize: 13, marginTop: 2, lineHeight: 17 },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    timeValue: { fontSize: 16, fontWeight: '600' },
    sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 4 },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    customTime: { flex: 1, paddingVertical: 6 },
    delete: {
      borderRadius: 22,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: { fontWeight: '700' },
    addButton: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 10,
    },
    addButtonText: { fontSize: 15, fontWeight: '600' },
  });
