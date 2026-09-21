// Allergies + health-conditions lists for the Profile tab: the editable
// rows with add inputs.

import { useCallback, useState } from 'react';
import {
  addAllergy,
  addCondition,
  deleteAllergy,
  deleteCondition,
  listAllergies,
  listConditions,
} from '../../db/catalog';
import type { Allergy, Condition } from '../../types';

export function useSimpleLists() {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  // Add-row inputs
  const [allergyInput, setAllergyInput] = useState('');
  const [conditionInput, setConditionInput] = useState('');

  /** Reload from the db (used by the tab's focus refresh). Stable so the
   *  screen can compose it into its own refresh callback. */
  const load = useCallback(() => {
    setAllergies(listAllergies());
    setConditions(listConditions());
  }, []);

  const addAllergyRow = () => {
    if (!allergyInput.trim()) return;
    addAllergy(allergyInput);
    setAllergyInput('');
    setAllergies(listAllergies());
  };

  const addConditionRow = () => {
    if (!conditionInput.trim()) return;
    addCondition(conditionInput);
    setConditionInput('');
    setConditions(listConditions());
  };

  const deleteAllergyRow = (id: number) => {
    deleteAllergy(id);
    setAllergies(listAllergies());
  };

  const deleteConditionRow = (id: number) => {
    deleteCondition(id);
    setConditions(listConditions());
  };

  return {
    allergies,
    allergyInput,
    setAllergyInput,
    conditions,
    conditionInput,
    setConditionInput,
    load,
    addAllergyRow,
    addConditionRow,
    deleteAllergyRow,
    deleteConditionRow,
  };
}
