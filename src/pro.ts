// KetoKind Pro: the one-time paid unlock.
// Free: all logging (meals, meds, supplements, symptoms, weight), dashboard,
// streaks, milestones. Pro ($9.99 one-time): AI Coach context export +
// backup export/import.
//
// Real Apple in-app purchases can't run in Expo Go (they need a paid Apple
// Developer account, App Store Connect products, and a development build), so
// purchases are SIMULATED for now. The UI is complete; only the bodies of
// requestPurchase()/restorePurchase() need replacing when real IAP lands.

import { getProStatus, setProStatus } from './db';

export const PRO_PRICE = '$9.99';

export const PRO_FEATURES: string[] = [
  'AI Coach context export — copy your coach prompt + 30 days of logs',
  'Backup export & import — move your data between phones',
];

/** Current entitlement, read live from the profile row. */
export function isProUser(): boolean {
  return getProStatus();
}

/** Grant Pro (used by a successful purchase and by the Testing toggle). */
export function grantPro(): void {
  setProStatus(true);
}

/** Revoke Pro (Testing toggle only — real purchases are never revoked here). */
export function revokePro(): void {
  setProStatus(false);
}

// ★★★ IAP HOOK-IN POINT ★★★
// TEST MODE: Expo Go cannot run real StoreKit purchases, so this simulates a
// successful one — no real charge, the Pro flag is set instantly.
// When real in-app purchases are wired up (StoreKit 2 via a development
// build, e.g. expo-iap, or RevenueCat), replace the body of requestPurchase()
// below with the real purchase flow.
//
// Gated on __DEV__: dev builds (Expo Go, simulators, TestFlight-internal
// testing) simulate the purchase; release builds ALWAYS take the real-IAP
// path, which throws "not wired up yet" until StoreKit is integrated. This
// makes it impossible to accidentally ship a fake $9.99 purchase button.
export const TEST_MODE_PURCHASE: boolean =
  typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export async function requestPurchase(): Promise<'purchased' | 'cancelled'> {
  if (TEST_MODE_PURCHASE) {
    grantPro(); // simulated success — no real charge
    return 'purchased';
  }
  // Real IAP goes here: initiate the StoreKit/RevenueCat purchase for the
  // $9.99 non-consumable product, then grantPro() on success.
  throw new Error('Real in-app purchase is not wired up yet.');
}

// ★★★ IAP HOOK-IN POINT (restore) ★★★
// TEST MODE: "restores" whatever the local flag already says — a free user
// gets "no purchase found", a Pro user gets confirmation.
// Real IAP: query StoreKit / RevenueCat for prior non-consumable purchases
// and call grantPro() if the Pro product is found. Mirror the test-gate
// pattern from requestPurchase() above so neither path can ship half-wired.
//
// IMPORTANT for the real implementation: the paywall UI must display the
// StoreKit-localized price for the product (e.g. product.price /
// localizedPrice) — never the hardcoded PRO_PRICE ('$9.99') above, which
// exists only for test mode.
export async function restorePurchase(): Promise<boolean> {
  if (TEST_MODE_PURCHASE) {
    return isProUser();
  }
  // Real IAP restore goes here.
  throw new Error('Real in-app purchase restore is not wired up yet.');
}
