// Medications + supplements manager for the Profile tab: the editable
// catalog rows with the add/edit form.

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import {
  addMedication,
  addSupplement,
  deleteMedication,
  deleteSupplement,
  listMedications,
  listSupplements,
  updateMedication,
  updateSupplement,
} from '../../db/catalog';
import type { Medication, Supplement } from '../../types';
import { parseIntStrict } from '../../numberParsing';
import type {
  EditingEntry,
  MedSuppFormState,
  MedSuppTab,
  SchedulableEntry,
} from './MedSuppSection';

const EMPTY_MED_SUPP_FORM: MedSuppFormState = {
  name: '',
  dosage: '',
  times: '1',
  purpose: '',
  asNeeded: false,
};

export function useMedSuppManager() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [medSuppTab, setMedSuppTab] = useState<MedSuppTab>('medication');
  const [medSuppForm, setMedSuppForm] = useState<MedSuppFormState>(EMPTY_MED_SUPP_FORM);
  // Non-null while an existing medication/supplement is loaded into the form.
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);

  /** Reload from the db (used by the tab's focus refresh). Stable so the
   *  screen can compose it into its own refresh callback. */
  const load = useCallback(() => {
    setMedications(listMedications());
    setSupplements(listSupplements());
  }, []);

  const clearMedSuppForm = () => {
    setMedSuppForm(EMPTY_MED_SUPP_FORM);
    setEditingEntry(null);
  };

  const changeTab = (t: MedSuppTab) => {
    setMedSuppTab(t);
    clearMedSuppForm();
  };

  const patchForm = (patch: Partial<MedSuppFormState>) =>
    setMedSuppForm((f) => ({ ...f, ...patch }));

  const startEditMedSupp = (tab: MedSuppTab, m: SchedulableEntry) => {
    setMedSuppTab(tab);
    setMedSuppForm({
      name: m.name,
      dosage: m.dosage,
      times: String(m.times_per_day),
      purpose: m.purpose,
      asNeeded: !!m.as_needed,
    });
    setEditingEntry({ tab, id: m.id });
  };

  const saveMedSuppRow = () => {
    const isMed = medSuppTab === 'medication';
    const kind = isMed ? 'medication' : 'supplement';
    if (!medSuppForm.name.trim()) return Alert.alert('Missing name', `Give the ${kind} a name.`);
    const times = parseIntStrict(medSuppForm.times);
    if (!medSuppForm.asNeeded && (times == null || times < 1 || times > 24)) {
      return Alert.alert('Invalid', 'Times per day must be a whole number between 1 and 24.');
    }
    const timesPerDay = times ?? 1; // irrelevant for as-needed items
    if (editingEntry) {
      if (editingEntry.tab === 'medication') {
        updateMedication(editingEntry.id, medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
        setMedications(listMedications());
      } else {
        updateSupplement(editingEntry.id, medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
        setSupplements(listSupplements());
      }
    } else if (isMed) {
      addMedication(medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
      setMedications(listMedications());
    } else {
      addSupplement(medSuppForm.name, medSuppForm.dosage, timesPerDay, medSuppForm.purpose, medSuppForm.asNeeded);
      setSupplements(listSupplements());
    }
    clearMedSuppForm();
  };

  const deleteMedicationRow = (id: number) => {
    deleteMedication(id);
    setMedications(listMedications());
    if (editingEntry?.tab === 'medication' && editingEntry.id === id) {
      clearMedSuppForm();
    }
  };

  const deleteSupplementRow = (id: number) => {
    deleteSupplement(id);
    setSupplements(listSupplements());
    if (editingEntry?.tab === 'supplement' && editingEntry.id === id) {
      clearMedSuppForm();
    }
  };

  return {
    medications,
    supplements,
    medSuppTab,
    medSuppForm,
    editingEntry,
    load,
    clearMedSuppForm,
    changeTab,
    patchForm,
    startEditMedSupp,
    saveMedSuppRow,
    deleteMedicationRow,
    deleteSupplementRow,
  };
}
