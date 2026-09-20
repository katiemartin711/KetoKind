// Diet Coach — app entry point.
// Bottom-tab navigation: Dashboard, Log, Profile, AI Coach.
// SQLite is initialized once at startup (synchronous, so at module level).

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { initDb } from './src/db';
import type { RootTabParamList } from './src/types';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import DashboardScreen from './src/screens/DashboardScreen';
import LogScreen from './src/screens/LogScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ExportScreen from './src/screens/ExportScreen';

initDb();

const Tab = createBottomTabNavigator<RootTabParamList>();

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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
