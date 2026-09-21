// KetoKind — app entry point.
// Bottom-tab navigation: Dashboard, Log, Profile, AI Coach.
// SQLite is initialized once at startup. If the database can't be opened
// (corrupt file, disk full, failed migration), we show a recovery screen
// instead of crashing — the user can wipe and start fresh.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { deleteDatabaseSync } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { initDb, closeDatabase } from './src/db';
import type { RootTabParamList } from './src/types';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { TabErrorBoundary } from './src/ErrorBoundary';
import DashboardScreen from './src/screens/DashboardScreen';
import LogScreen from './src/screens/LogScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ExportScreen from './src/screens/ExportScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

// Keep the native splash from auto-hiding before JS loads (matters for
// production builds; in Expo Go the plugin config isn't displayed, so the
// BrandedSplash overlay below is what the user actually sees).
// Must be called at module scope — inside a component it can run too late.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

const SPLASH_HOLD_MS = 2500;
const SPLASH_FADE_MS = 500;

// Branded launch moment, rendered in JS so it shows identically in Expo Go
// and in production builds: holds the KetoKind mark for a beat, then fades.
function BrandedSplash({ onHidden }: { onHidden: () => void }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }).start(() => onHidden());
    }, SPLASH_HOLD_MS);
    return () => clearTimeout(t);
  }, [opacity, onHidden]);

  return (
    <Animated.View
      style={[splashStyles.container, { opacity, backgroundColor: colors.background }]}
    >
      <View style={[splashStyles.emblem, { backgroundColor: colors.accent }]}>
        <Text style={[splashStyles.emblemText, { color: colors.background }]}>K</Text>
      </View>
      <Text style={[splashStyles.wordmark, { color: colors.text }]}>KetoKind</Text>
    </Animated.View>
  );
}

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home-outline',
  Log: 'add-circle-outline',
  Profile: 'person-outline',
  'AI Coach': 'chatbubble-ellipses-outline',
};

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const hideSplash = useCallback(() => setSplashDone(true), []);

  return (
    <>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Dashboard">
            {() => (
              <TabErrorBoundary tabName="Dashboard">
                <DashboardScreen />
              </TabErrorBoundary>
            )}
          </Tab.Screen>
          <Tab.Screen name="Log">
            {() => (
              <TabErrorBoundary tabName="Log">
                <LogScreen />
              </TabErrorBoundary>
            )}
          </Tab.Screen>
          <Tab.Screen name="Profile">
            {() => (
              <TabErrorBoundary tabName="Profile">
                <ProfileScreen />
              </TabErrorBoundary>
            )}
          </Tab.Screen>
          <Tab.Screen name="AI Coach">
            {() => (
              <TabErrorBoundary tabName="AI Coach">
                <ExportScreen />
              </TabErrorBoundary>
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!splashDone && <BrandedSplash onHidden={hideSplash} />}
    </>
  );
}

export default function App() {
  // initDb() runs here (not at module level) so a failure can be caught and
  // shown instead of crashing the app during import.
  const [dbError, setDbError] = useState<Error | null>(() => {
    try {
      initDb();
      return null;
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e));
    }
  });

  // Release the native splash as soon as JS is up — the BrandedSplash
  // overlay above carries the visible branding from here.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const resetDb = () => {
    try {
      // Close the open handle first: the file can't be deleted while it's
      // open, and the stale handle would keep writing to the deleted file.
      closeDatabase();
      deleteDatabaseSync('ketokind.db');
      initDb();
      setDbError(null);
    } catch (e) {
      setDbError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  if (dbError) {
    return (
      <SafeAreaProvider>
        <View style={errStyles.container}>
          <Text style={errStyles.title}>Something went wrong</Text>
          <Text style={errStyles.body}>
            KetoKind couldn't open its on-device database
            {dbError.message ? ` (${dbError.message})` : ''}. You can reset the
            app's data and start fresh — this deletes everything stored on this device.
          </Text>
          <TouchableOpacity style={errStyles.button} onPress={resetDb}>
            <Text style={errStyles.buttonText}>Reset app data</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  emblem: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emblemText: {
    fontSize: 64,
    fontWeight: '700',
  },
  wordmark: {
    fontSize: 40,
    fontWeight: '700',
  },
});

const errStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FAFAF7',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  body: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  button: { backgroundColor: '#C62828', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
