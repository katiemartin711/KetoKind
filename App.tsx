// KetoKind — app entry point.
// Bottom-tab navigation: Dashboard, Log, Trends, Profile, AI Coach.
// SQLite is initialized once at startup. If the database can't be opened
// (corrupt file, disk full, failed migration), we show a recovery screen
// instead of crashing — the user can wipe and start fresh.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, Animated, AppState, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { initDb } from './src/db/schema';
import { resetLocalDatabase } from './src/db/reset';
import { ensureReminderSetup, reconcileReminders } from './src/reminders';
import type { RootStackParamList, RootTabParamList } from './src/types';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { TabErrorBoundary } from './src/ErrorBoundary';
import DashboardScreen from './src/screens/DashboardScreen';
import LogScreen from './src/screens/LogScreen';
import LogListScreen from './src/screens/LogListScreen';
import TrendsScreen from './src/screens/TrendsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ExportScreen from './src/screens/ExportScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Keep the native splash from auto-hiding before JS loads (matters for
// production builds; in Expo Go the plugin config isn't displayed, so the
// BrandedSplash overlay below is what the user actually sees).
// Must be called at module scope — inside a component it can run too late.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

const SPLASH_HOLD_MS = 400;
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
  Trends: 'trending-up-outline',
  Profile: 'person-outline',
  'AI Coach': 'chatbubble-ellipses-outline',
};

function TabNavigator() {
  const { colors } = useTheme();
  return (
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
      <Tab.Screen name="Trends">
        {() => (
          <TabErrorBoundary tabName="Trends">
            <TrendsScreen />
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
  );
}

function ThemedApp() {
  const { isDark } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const hideSplash = useCallback(() => setSplashDone(true), []);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // Local reminder notifications (on-device only, no network):
  // - first launch writes the default 8pm-nudge settings and asks for
  //   permission once; every launch re-reconciles the schedule;
  // - re-check whenever the app comes back from the background, so the
  //   "only if you haven't logged" condition stays accurate;
  // - tapping a reminder opens the Log tab.
  useEffect(() => {
    ensureReminderSetup();
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reconcileReminders();
    });
    const openLogTab = () => {
      if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Log' });
    };
    const notifSub = Notifications.addNotificationResponseReceivedListener(openLogTab);
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) openLogTab();
    });
    return () => {
      appStateSub.remove();
      notifSub.remove();
    };
  }, [navigationRef]);

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen name="LogList">
            {() => (
              <TabErrorBoundary tabName="LogList">
                <LogListScreen />
              </TabErrorBoundary>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!splashDone && <BrandedSplash onHidden={hideSplash} />}
    </>
  );
}

// Startup recovery screen when the database can't be opened. Rendered
// outside the ThemeProvider (the theme lives with the db-backed app), so it
// reads the OS color scheme directly — no bright flash on dark-mode phones.
function DbErrorScreen({ error, onReset }: { error: Error; onReset: () => void }) {
  const dark = useColorScheme() === 'dark';
  const C = {
    background: dark ? '#121615' : '#FAFAF7',
    text: dark ? '#E9EDEB' : '#1F2937',
    muted: dark ? '#9BA6A1' : '#6B7280',
  };
  return (
    <SafeAreaProvider>
      <View style={[errStyles.container, { backgroundColor: C.background }]}>
        <Text style={[errStyles.title, { color: C.text }]}>Something went wrong</Text>
        <Text style={[errStyles.body, { color: C.muted }]}>
          KetoKind couldn't open its on-device database
          {error.message ? ` (${error.message})` : ''}. You can reset the
          app's data and start fresh — this deletes everything stored on this device.
        </Text>
        <TouchableOpacity
          style={errStyles.button}
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel="Reset app data"
        >
          <Text style={errStyles.buttonText}>Reset app data</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaProvider>
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
      resetLocalDatabase();
      setDbError(null);
    } catch (e) {
      setDbError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  /** Wiping is one-way — make the user confirm before anything is deleted. */
  const confirmResetDb = () => {
    Alert.alert(
      'Reset app data?',
      'This deletes every meal, log, and setting on this device. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetDb },
      ],
    );
  };

  if (dbError) {
    return <DbErrorScreen error={dbError} onReset={confirmResetDb} />;
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
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  button: { backgroundColor: '#C62828', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
