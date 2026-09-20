// Shared screen wrapper for forms: keeps the keyboard from covering inputs.
// KeyboardAvoidingView shrinks the visible area above the keyboard and the
// inner ScrollView lets the user reach any field while typing.

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { common } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function KeyboardScrollView({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    // Top edge only: the bottom tab bar already handles the bottom inset.
    <SafeAreaView style={common.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // Account for the bottom tab bar between the view and the screen edge.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[common.scroll, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
