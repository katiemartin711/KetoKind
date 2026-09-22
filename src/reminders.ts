// Local reminder notifications: permission handling and scheduling.
//
// Everything here is on-device (expo-notifications local scheduling) — no
// server, no push tokens, no network. That keeps the privacy policy's
// "no app-initiated network requests" promise intact.
//
// Scheduling strategy: reconcile() cancels our previously scheduled
// notifications and re-schedules concrete one-shot fire times for the next
// 7 days (see computeOccurrences in reminderLogic.ts). It runs on app start,
// every foreground, and after any log add/edit/delete, so the
// "only remind when nothing was logged today" condition is always evaluated
// against fresh data.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getLogsForDay } from './db/logs';
import { getReminderSettings, hasReminderSettings, saveReminderSettings } from './db/profile';
import { computeOccurrences, type ReminderSettings } from './reminderLogic';

export type { ReminderSettings };

const ID_PREFIX = 'ketokind-reminder-';
const ANDROID_CHANNEL = 'ketokind-reminders';
const DAYS_AHEAD = 7;

// Show the banner/list even when the app is in the foreground — a reminder
// is still useful if KetoKind happens to be open at 8pm.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** 'granted' | 'denied' | 'undetermined' (never asked). */
export async function getNotificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/** Ask for permission if we haven't been denied; true when we can schedule. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

async function cancelOurScheduled(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(ID_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // Scheduling is best-effort; never break the app over it.
  }
}

/**
 * Re-evaluate and re-schedule all reminders. Safe to call often: it first
 * cancels everything we previously scheduled, then schedules fresh.
 */
export async function reconcileReminders(): Promise<void> {
  try {
    const settings = getReminderSettings();
    await cancelOurScheduled();
    if (!settings.enabled) {
      await Notifications.setBadgeCountAsync(0).catch(() => {});
      return;
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.setBadgeCountAsync(0).catch(() => {});

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Log reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => {});
    }

    const now = new Date();
    const hasLogsToday = getLogsForDay(now).length > 0;
    const occurrences = computeOccurrences(settings, now, hasLogsToday, DAYS_AHEAD);

    for (const occ of occurrences) {
      const isMain = occ.kind === 'main';
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${isMain ? 'main' : `custom-${occ.customId}`}-${occ.date.getTime()}`,
        content: {
          title: isMain ? 'Time to log your day' : 'KetoKind reminder',
          body: isMain
            ? settings.onlyIfNoLogs
              ? "You haven't logged anything today — take a minute to jot down your meals."
              : 'Take a minute to log your meals and how you feel today.'
            : 'Time for your scheduled check-in — open KetoKind to log.',
          sound: settings.sound ? 'default' : undefined,
          badge: settings.badge ? 1 : undefined,
          data: { kind: occ.kind },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: occ.date,
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
        },
      });
    }
  } catch {
    // Reminders are best-effort; never break the app over them.
  }
}

/**
 * First-run setup: if reminder settings were never configured, store the
 * defaults (8pm daily nudge) and ask for notification permission once so the
 * default can actually fire. Afterwards, reconcile the schedule.
 */
export async function ensureReminderSetup(): Promise<void> {
  try {
    if (!hasReminderSettings()) {
      saveReminderSettings({
        enabled: true,
        time: { hour: 20, minute: 0 },
        onlyIfNoLogs: true,
        sound: true,
        badge: true,
        custom: [],
      });
      await ensureNotificationPermission();
    }
  } catch {
    // Fall through to reconcile regardless.
  }
  await reconcileReminders();
}

/** Update one settings field, persist, and re-schedule. */
export async function updateReminderSettings(patch: Partial<ReminderSettings>): Promise<ReminderSettings> {
  const next: ReminderSettings = { ...getReminderSettings(), ...patch };
  saveReminderSettings(next);
  await reconcileReminders();
  return next;
}
