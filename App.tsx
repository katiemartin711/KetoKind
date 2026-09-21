// KetoKind — app entry point.
// Bottom-tab navigation: Dashboard, Log, Profile, AI Coach.
// SQLite is initialized once at startup. If the database can't be opened
// (corrupt file, disk full, failed migration), we show a recovery screen
// instead of crashing — the user can wipe and start fresh.

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { deleteDatabaseSync } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { initDb } from './src/db';
import type { RootTabParamList } from './src/types';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import DashboardScreen from './src/screens/DashboardScreen';
import LogScreen from './src/screens/LogScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ExportScreen from './src/screens/ExportScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

// Keep the native splash screen visible until the app has rendered.
// Must be called at module scope — inside a component it can run too late.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home-outline',
  Log: 'add-circle-outline',
  Profile: 'person-outline',
  'AI Coach': 'chatbubble-ellipses-outline',
};

function ThemedApp() {
  const { colors, isDark } = useTheme();

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
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Log" component={LogScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
          <Tab.Screen name="AI Coach" component={ExportScreen} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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

  // initDb() above runs synchronously during first render, so once we're
  // mounted the app is ready to show — hold the splash briefly so the
  // branding is actually seen, then fade out.
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  const resetDb = () => {
    try {
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
