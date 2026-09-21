// Per-tab error boundary: if a screen throws during render (e.g. a database
// read on focus hits a corrupt row), the whole app used to crash. Now the tab
// shows a recovery screen instead — "Try again" re-renders the tab, "Reset
// app data" wipes the on-device database and starts fresh (same recovery
// pattern as the startup dbError screen in App.tsx).

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteDatabaseSync } from 'expo-sqlite';
import { closeDatabase, initDb } from './db';
import { useTheme } from './ThemeContext';

interface BoundaryProps {
  children: React.ReactNode;
  /** Shown in the console when the boundary catches, e.g. "Profile". */
  tabName: string;
}

interface BoundaryState {
  error: Error | null;
}

export class TabErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error(`[TabErrorBoundary:${this.props.tabName}]`, error);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  /** Last-resort recovery: close the handle, delete the db file, re-init. */
  private resetAppData = (): void => {
    try {
      closeDatabase();
      deleteDatabaseSync('ketokind.db');
      initDb();
      this.retry();
    } catch (e) {
      this.setState({ error: e instanceof Error ? e : new Error(String(e)) });
    }
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <TabErrorFallback
          error={this.state.error}
          onRetry={this.retry}
          onResetAppData={this.resetAppData}
        />
      );
    }
    return this.props.children;
  }
}

function TabErrorFallback({
  error,
  onRetry,
  onResetAppData,
}: {
  error: Error;
  onRetry: () => void;
  onResetAppData: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.body, { color: colors.muted }]}>
        This tab ran into a problem{error.message ? ` (${error.message})` : ''}. Your data is
        still on this device — try again, or reset the app's data to start fresh.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.accent }]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.dangerButton]}
        onPress={onResetAppData}
        accessibilityRole="button"
        accessibilityLabel="Reset app data"
      >
        <Text style={styles.buttonText}>Reset app data</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  dangerButton: { backgroundColor: '#C62828' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
