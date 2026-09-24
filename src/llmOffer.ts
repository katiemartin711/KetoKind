// What to do when a meal is saved, given the on-device model state.
// The meal itself is always written first. This only decides whether to
// estimate, ask to download, or leave macros blank.

export type LlmOffer = '' | 'declined';

export type MealSavePlan = 'save-only' | 'prompt-download' | 'estimate';

export function planMealSave(opts: {
  modelReady: boolean;
  nativeAvailable: boolean;
  offer: LlmOffer;
  userEditedMacros: boolean;
}): MealSavePlan {
  if (opts.userEditedMacros) return 'save-only';
  if (opts.modelReady) return 'estimate';
  if (opts.nativeAvailable && opts.offer !== 'declined') return 'prompt-download';
  return 'save-only';
}
