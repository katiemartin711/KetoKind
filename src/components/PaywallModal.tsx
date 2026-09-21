// Paywall modal: the KetoKind Pro upgrade screen, presented as an overlay
// from the AI Coach tab (locked state) and the Profile tab (Pro row /
// backup buttons). Purchases are SIMULATED for now — see src/pro.ts for the
// IAP hook-in point where real StoreKit/RevenueCat wiring goes later.

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import type { Palette } from '../theme';
import {
  PRO_FEATURES,
  PRO_PRICE,
  TEST_MODE_PURCHASE,
  isProUser,
  requestPurchase,
  restorePurchase,
} from '../pro';

interface Props {
  visible: boolean;
  /** Dismiss the modal. */
  onClose: () => void;
  /** Called after a successful purchase/restore so the host can refresh. */
  onUnlocked: () => void;
}

export default function PaywallModal({ visible, onClose, onUnlocked }: Props) {
  const { colors, common } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);

  const upgrade = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requestPurchase();
      if (result === 'purchased') {
        onUnlocked();
        onClose();
        Alert.alert('Welcome to Pro', 'KetoKind Pro is unlocked on this device.');
      }
    } catch (e) {
      Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Could not complete the purchase.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const found = await restorePurchase();
      if (found) {
        onUnlocked();
        onClose();
        Alert.alert('Purchase restored', 'KetoKind Pro is active on this device.');
      } else {
        Alert.alert('No purchase found', 'No previous KetoKind Pro purchase was found.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={[styles.closeText, { color: colors.muted }]}>✕</Text>
          </TouchableOpacity>

          <View style={[styles.emblem, { backgroundColor: colors.accent }]}>
            <Text style={[styles.emblemText, { color: colors.background }]}>K</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>KetoKind Pro</Text>
          <Text style={[styles.price, { color: colors.accent }]}>
            {PRO_PRICE} — one-time purchase
          </Text>

          {TEST_MODE_PURCHASE && (
            <Text style={[styles.testBadge, { color: colors.muted }]}>
              TEST MODE — no real charge. Purchases are simulated.
            </Text>
          )}

          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={[styles.check, { color: colors.accent }]}>✓</Text>
                <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
              </View>
            ))}
          </View>

          {isProUser() ? (
            <Text style={[styles.proActive, { color: colors.accent }]}>
              Pro is active on this device ✓
            </Text>
          ) : (
            <TouchableOpacity
              style={[common.primaryButton, styles.upgradeButton]}
              onPress={upgrade}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={common.primaryButtonText}>Upgrade to Pro — {PRO_PRICE}</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={common.secondaryButton}
            onPress={restore}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={common.secondaryButtonText}>Restore Purchase</Text>
          </TouchableOpacity>

          <Text style={[styles.finePrint, { color: colors.muted }]}>
            Everything else in KetoKind — food, medication, supplement, symptom, and
            weight logging, the dashboard, streaks, and milestones — is free forever.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderBottomWidth: 0,
      padding: 24,
      paddingBottom: 40,
      alignItems: 'center',
    },
    close: {
      position: 'absolute',
      top: 12,
      right: 16,
      padding: 8,
    },
    closeText: { fontSize: 20, fontWeight: '600' },
    emblem: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emblemText: { fontSize: 34, fontWeight: '700' },
    title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
    price: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
    testBadge: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 16,
      textAlign: 'center',
    },
    features: { alignSelf: 'stretch', marginBottom: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    check: { fontSize: 16, fontWeight: '700', marginRight: 10, marginTop: 1 },
    featureText: { fontSize: 15, lineHeight: 21, flex: 1 },
    proActive: { fontSize: 16, fontWeight: '700', marginVertical: 16 },
    upgradeButton: { alignSelf: 'stretch' },
    finePrint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 16 },
  });
