// Diet + about-me form state for the Profile tab: diet type, diet nuances,
// goals, diet start, name, age, sex, bio, and the save handler.

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { getProfile, persistDietType, saveProfile } from '../../db/profile';
import type { DietType, Profile } from '../../types';
import { parseDietStart } from '../../milestones';
import { validateProfileInputs } from '../../profileValidation';
import type { DietStartParts } from './DietSection';
import type { SexOption } from './AboutSection';

export function useDietAboutForm() {
  const [dietType, setDietType] = useState<DietType>('carnivore');
  const [infoDiet, setInfoDiet] = useState<DietType | null>(null);
  const [nuances, setNuances] = useState('');
  const [goals, setGoals] = useState('');
  const [dietStart, setDietStart] = useState<DietStartParts>({ month: '', day: '', year: '' });
  // Last-saved values, powering the permanent "time on diet" callout.
  const [savedDietStart, setSavedDietStart] = useState<string | null>(null);
  const [savedDietType, setSavedDietType] = useState<DietType>('carnivore');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<SexOption>('');
  const [bio, setBio] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  /** Reload from the db (used by the tab's focus refresh). Stable so the
   *  screen can compose it into its own refresh callback. */
  const load = useCallback((p: Profile = getProfile()) => {
    setDietType(p.diet_type);
    setNuances(p.diet_nuances);
    setGoals(p.goals);
    const ds = parseDietStart(p.diet_start);
    setDietStart({
      month: ds ? String(ds.month) : '',
      day: ds?.day != null ? String(ds.day) : '',
      year: ds ? String(ds.year) : '',
    });
    setSavedDietStart(p.diet_start);
    setSavedDietType(p.diet_type);
    setName(p.name || '');
    setAge(p.age != null ? String(p.age) : '');
    setSex(p.sex === 'female' || p.sex === 'male' ? p.sex : '');
    setBio(p.bio || '');
  }, []);

  const selectDiet = (d: DietType) => {
    setDietType(d);
    setSavedDietType(d);
    persistDietType(d);
  };

  const toggleDietInfo = (d: DietType) => setInfoDiet((cur) => (cur === d ? null : d));

  const updateDietStart = (part: keyof DietStartParts, value: string) =>
    setDietStart((s) => ({ ...s, [part]: value }));

  const onSave = () => {
    const v = validateProfileInputs(age, dietStart);
    if (!v.ok) return Alert.alert('Invalid', v.message);
    saveProfile(dietType, nuances, goals, v.age, sex, bio.trim(), v.dietStart, name);
    setSavedDietStart(v.dietStart);
    setSavedDietType(dietType);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  return {
    dietType,
    infoDiet,
    nuances,
    setNuances,
    goals,
    setGoals,
    dietStart,
    updateDietStart,
    savedDietStart,
    savedDietType,
    name,
    setName,
    age,
    setAge,
    sex,
    setSex,
    bio,
    setBio,
    savedFlash,
    load,
    selectDiet,
    toggleDietInfo,
    onSave,
  };
}
