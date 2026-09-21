// AI Coach tab: builds one copy-paste block — a ready-made coach prompt followed by
// the user's profile + last-30-day logs in Markdown — for the AI chat of their choice
// (ChatGPT, Claude, etc.). A separate share-file option exports just the context file.
// Nothing AI-related runs inside this app — no API keys, no servers.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { getExportData } from '../db/exportData';
import { getProStatus } from '../db/profile';
import type { ExportData } from '../db/exportData';
import PaywallModal from '../components/PaywallModal';
import { DIET_LABELS } from '../types';
import { dietPrinciples } from '../dietPrinciples';
import { dietDurationLabel, formatDietStart } from '../milestones';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** The Markdown context file: profile + trailing-30-day summary. */
function buildContextMarkdown(data: ExportData): string {
  const { profile, allergies, conditions, medications, supplements, counts30, rangeLabel } = data;
  const lines: string[] = [];
  const list = (items: string[]) => (items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '- None recorded');

  lines.push('# KetoKind — AI Context File');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  lines.push(`_Exported ${new Date().toLocaleString()} (${tz})_`);
  lines.push('');
  lines.push('## Profile');
  lines.push(`- **Name:** ${profile.name || 'Not specified'}`);
  lines.push(`- **Diet type:** ${DIET_LABELS[profile.diet_type]}`);
  const dietStartFmt = formatDietStart(profile.diet_start);
  const dietDuration = dietDurationLabel(profile.diet_start);
  lines.push(
    `- **Diet started:** ${dietStartFmt}${dietDuration ? ` (${dietDuration} on this diet)` : ''}`,
  );
  lines.push(`- **Age:** ${profile.age != null ? profile.age : 'Not specified'}`);
  lines.push(`- **Sex:** ${profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : 'Not specified'}`);
  lines.push(`- **About me:** ${profile.bio || 'Not specified'}`);
  lines.push(`- **Diet nuances:** ${profile.diet_nuances || 'Not specified'}`);
  lines.push(`- **Goals:** ${profile.goals || 'Not specified'}`);
  lines.push(`- **Allergies:** ${allergies.map((a) => a.name).join(', ') || 'None recorded'}`);
  lines.push(`- **Health conditions:** ${conditions.map((c) => c.name).join(', ') || 'None recorded'}`);
  lines.push(
    `- **Medications:** ${medications.map((m) => `${m.name}${m.dosage ? ` (${m.dosage})` : ''} — ${m.as_needed ? 'as needed' : `${m.times_per_day}x/day`}${m.purpose ? `, for ${m.purpose}` : ''}`).join('; ') || 'None recorded'}`,
  );
  lines.push(
    `- **Supplements:** ${supplements.map((s) => `${s.name}${s.dosage ? ` (${s.dosage})` : ''} — ${s.as_needed ? 'as needed' : `${s.times_per_day}x/day`}${s.purpose ? `, for ${s.purpose}` : ''}`).join('; ') || 'None recorded'}`,
  );
  lines.push('');
  lines.push(`## Last 30 days (${rangeLabel})`);
  lines.push(`- Meals logged: ${counts30.meals}`);
  lines.push(`- Medication doses taken: ${counts30.medsTaken}`);
  lines.push(`- Symptoms logged: ${counts30.symptoms}`);
  lines.push(`- Supplements logged: ${counts30.supplements}`);
  lines.push('');

  if (data.recentMeals.length > 0) {
    lines.push('### Recent meals');
    for (const m of data.recentMeals) {
      lines.push(`- ${fmtDateTime(m.logged_at)} — ${m.meal_type}: ${m.name}${m.notes ? ` (${m.notes})` : ''}`);
    }
    lines.push('');
  }
  if (data.recentSymptoms.length > 0) {
    lines.push('### Recent symptoms');
    for (const s of data.recentSymptoms) {
      lines.push(`- ${fmtDateTime(s.logged_at)} — ${s.name} (severity ${s.severity}/5)${s.notes ? ` (${s.notes})` : ''}`);
    }
    lines.push('');
  }
  if (data.recentSupplements.length > 0) {
    lines.push('### Recent supplements');
    for (const s of data.recentSupplements) {
      const qty = s.quantity > 1 ? ` (took ${s.quantity})` : '';
      lines.push(`- ${fmtDateTime(s.logged_at)} — ${s.name}${qty}${s.notes ? ` (${s.notes})` : ''}`);
    }
    lines.push('');
  }
  if (data.recentMeds.length > 0) {
    lines.push('### Recent medication doses');
    for (const m of data.recentMeds) {
      const name = m.medication_name || 'Deleted medication';
      const qty = m.quantity > 1 ? ` (took ${m.quantity})` : '';
      lines.push(`- ${fmtDateTime(m.taken_at)} — ${name} taken${qty}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('_Generated by KetoKind. Paste this with the coach setup prompt into your preferred AI chat._');
  return lines.join('\n');
}

/** The ready-to-paste prompt that turns any AI chat into the user's coach. */
function buildCoachPrompt(data: ExportData): string {
  const dietLabel = DIET_LABELS[data.profile.diet_type];
  const principles = dietPrinciples(data.profile.diet_type)
    .map((p, i) => `${i + 1}. ${p}`)
    .join('\n');
  return (
    `You are my ${dietLabel} diet coach. Below is my diet profile ` +
    `(diet type, personal nuances, allergies, health conditions, medications, supplements) and my food, symptom, ` +
    `supplement, and medication logs from the last 30 days.\n\n` +
    `Start by greeting me by name (use my name if it appears in my profile; otherwise just say hello), ` +
    `confirm you have my logs, and ask whether I want insights into my data or have a specific question or concern ` +
    `I want to talk about. Keep every response brief — no long lectures, no unasked-for analysis.\n\n` +
    `Guiding principles:\n` +
    principles +
    `\n\n` +
    `When I ask about my food or macros, estimate protein, fat, and carbs from what's in my logs using typical values for each food. ` +
    `If an entry is too vague to estimate (like "steak" with no portion size), ask me one or two quick questions about portion sizes of the most common items first, then give your best estimate.\n\n` +
    `Important: you are not a medical professional and this is not medical advice. ` +
    `Never tell me to start, stop, or change any medication — only my doctor can do that. ` +
    `If anything in my logs looks concerning, tell me to talk to my doctor.`
  );
}

export default function ExportScreen() {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [markdown, setMarkdown] = useState('');
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const refresh = useCallback(() => {
    const pro = getProStatus();
    setIsPro(pro);
    if (!pro) return; // free users see the Pro upsell, not the export UI
    const data = getExportData();
    setMarkdown(buildContextMarkdown(data));
    setPrompt(buildCoachPrompt(data));
  }, []);

  useFocusEffect(refresh);

  const combined = useMemo(() => `${prompt}\n\n---\n\n${markdown}`, [prompt, markdown]);

  const copyAll = async () => {
    await Clipboard.setStringAsync(combined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAndShare = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        return Alert.alert('Unavailable', 'Sharing is not available on this device.');
      }
      const file = new File(Paths.cache, 'ketokind-context.md');
      file.write(markdown);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/markdown',
        dialogTitle: 'Share your AI context file',
      });
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <>
      <SafeAreaView style={common.screen} edges={['top']}>
        <ScrollView contentContainerStyle={common.scroll}>
          <Text style={common.h1}>AI Coach</Text>
          {!isPro ? (
            <View style={common.card}>
              <Text style={common.h2}>KetoKind Pro</Text>
              <Text style={common.subtitle}>
                The AI Coach export — your coach prompt plus 30 days of logs, ready to
                paste into the AI chat of your choice — is a Pro feature.
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
              <Text style={common.subtitle}>
                Copy your setup prompt plus your profile and last 30 days of logs as one block, then
                paste it into the AI chat of your choice. Your data stays on your device until you
                choose to share it.
              </Text>

              <TouchableOpacity style={common.primaryButton} onPress={copyAll}>
                <Text style={common.primaryButtonText}>
                  {copied ? 'Copied ✓ — paste it into your AI chat' : 'Copy prompt + logs'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={common.secondaryButton} onPress={exportAndShare}>
                <Text style={common.secondaryButtonText}>
                  {shared ? 'Shared ✓' : 'Share context file only (.md)'}
                </Text>
              </TouchableOpacity>

              <Text style={[common.h2, { marginTop: 20 }]}>Coach prompt preview</Text>
              <View style={common.card}>
                <Text style={styles.mono}>{prompt}</Text>
              </View>

              <Text style={[common.h2, { marginTop: 8 }]}>Context file preview</Text>
              <View style={common.card}>
                <Text style={styles.mono}>{markdown}</Text>
              </View>
            </>
          )}

          <Text style={styles.disclaimer}>
            KetoKind is a logging tool, not a medical professional. Nothing here is medical advice.
            Talk to your doctor before changing medications, supplements, or your diet — especially
            with health conditions.
          </Text>
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
    mono: {
      fontFamily: 'monospace',
      fontSize: 12,
      color: C.text,
      lineHeight: 18,
    },
    disclaimer: {
      fontSize: 12,
      color: C.muted,
      marginTop: 8,
      lineHeight: 17,
    },
  });
