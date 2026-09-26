// AI Coach tab: builds one copy-paste block — a ready-made coach prompt followed by
// the user's profile + last-30-day logs in Markdown — for the AI chat of their choice
// (ChatGPT, Claude, etc.). A separate share-file option exports just the context file.
// This tab does not call a model. On-device estimates live on the Log and Trends tabs.

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { getExportData } from '../db/exportData';
import { getProStatus } from '../db/profile';
import PaywallModal from '../components/PaywallModal';
import { buildCoachPrompt, buildContextMarkdown } from '../exportMarkdown';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';

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
    if (!pro) {
      setMarkdown('');
      setPrompt('');
      return; // free users see the Pro upsell, not the export UI
    }
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
