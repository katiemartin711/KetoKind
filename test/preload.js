// Test preload for the component test(s). Loaded with `node -r ./test/preload.js`
// (see package.json "test"). Plain JS on purpose: it is NOT compiled by tsc
// and is invisible to both the app and test tsconfigs.
//
// Why this exists: @testing-library/react-native's entry point calls
// `expect.extend(...)` at import time, and its components need react-native.
// This repo runs tests under plain node (no jest, no RN runtime), so we:
//   1. Provide a minimal `expect` global whose `extend` is a no-op. The
//      jest matchers are never used — assertions use the repo's own
//      check()/ok()/eq() helpers. Only RNTL's synchronous APIs
//      (render/screen/fireEvent) are used; waitFor/findBy would need jest's
//      fake timers and are off-limits.
//   2. Stub `react-native` with string host components + the small API
//      surface the tested components touch (StyleSheet, Platform,
//      useColorScheme, Alert). String tags keep react-test-renderer's host
//      detection working so RNTL queries behave.
//   3. Stub `@expo/ui/community/datetime-picker` (a native module) with a
//      null-rendering component; the component tests never exercise the
//      native picker UI.
//
// This harness is intentionally narrow: it covers MedSuppForm and its direct
// children. Components pulling in more native modules need their own stubs.

'use strict';

// jest's expect() is unavailable; RNTL only needs expect.extend at import.
global.expect = Object.assign(
  () => {
    throw new Error('jest expect() is not available in this runner');
  },
  { extend: () => {} },
);

const Module = require('module');
const origLoad = Module._load;

function mockReactNative() {
  const host = (name) => name;
  return {
    View: host('View'),
    Text: host('Text'),
    TextInput: host('TextInput'),
    TouchableOpacity: host('TouchableOpacity'),
    TouchableHighlight: host('TouchableHighlight'),
    TouchableWithoutFeedback: host('TouchableWithoutFeedback'),
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    FlatList: host('FlatList'),
    SectionList: host('SectionList'),
    Modal: host('Modal'),
    Switch: host('Switch'),
    Image: host('Image'),
    ActivityIndicator: host('ActivityIndicator'),
    RefreshControl: host('RefreshControl'),
    SafeAreaView: host('SafeAreaView'),
    StatusBar: host('StatusBar'),
    KeyboardAvoidingView: host('KeyboardAvoidingView'),
    StyleSheet: {
      create: (s) => s,
      flatten: (s) =>
        Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s || {},
      hairlineWidth: 1,
      absoluteFill: {},
    },
    Platform: {
      OS: 'ios',
      Version: 17,
      select: (o) => (o.ios !== undefined ? o.ios : o.default),
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
      addEventListener: () => ({ remove: () => {} }),
    },
    Alert: { alert: () => {} },
    Animated: {
      View: host('Animated.View'),
      Text: host('Animated.Text'),
      Value: function (v) {
        this.v = v;
      },
      timing: () => ({ start: (cb) => cb && cb() }),
    },
    Easing: { linear: {}, ease: {} },
    I18nManager: { isRTL: false },
    NativeModules: {},
    findNodeHandle: () => null,
    useColorScheme: () => 'light',
    Appearance: {
      getColorScheme: () => 'light',
      addChangeListener: () => ({ remove: () => {} }),
    },
    BackHandler: { addEventListener: () => ({ remove: () => {} }) },
    Keyboard: { addListener: () => ({ remove: () => {} }), dismiss: () => {} },
    PixelRatio: { get: () => 2 },
    processColor: (c) => c,
  };
}

const reactNativeMock = mockReactNative();
// Null-rendering stand-in for the native date/time picker UI.
const dateTimePickerMock = { __esModule: true, default: () => null };

Module._load = function (request, parent, isMain) {
  if (request === 'react-native') return reactNativeMock;
  if (request === '@expo/ui/community/datetime-picker') return dateTimePickerMock;
  return origLoad.apply(this, arguments);
};
