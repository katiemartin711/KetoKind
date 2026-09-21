// Weight-tracking settings for the Profile tab: the tracking toggle,
// starting weight, and the save handler.

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { getProfile, setWeightTracking } from '../../db/profile';
import type { Profile } from '../../types';
import { parseFloatStrict } from '../../numberParsing';

export function useWeightSettings() {
  const [trackWeight, setTrackWeight] = useState(false);
  const [startingWeight, setStartingWeight] = useState('');
  const [weightSavedFlash, setWeightSavedFlash] = useState(false);

  /** Reload from the db (used by the tab's focus refresh). Stable so the
   *  screen can compose it into its own refresh callback. */
  const load = useCallback((p: Profile = getProfile()) => {
    setTrackWeight(!!p.track_weight);
    setStartingWeight(p.starting_weight != null ? String(p.starting_weight) : '');
  }, []);

  const saveWeightSettings = () => {
    let sw: number | null = null;
    if (trackWeight && startingWeight.trim() !== '') {
      const n = parseFloatStrict(startingWeight);
      if (n == null || n <= 0) {
        return Alert.alert('Invalid', 'Starting weight must be a positive number.');
      }
      sw = n;
    }
    setWeightTracking(trackWeight, sw);
    setWeightSavedFlash(true);
    setTimeout(() => setWeightSavedFlash(false), 2000);
  };

  return {
    trackWeight,
    setTrackWeight,
    startingWeight,
    setStartingWeight,
    weightSavedFlash,
    load,
    saveWeightSettings,
  };
}
