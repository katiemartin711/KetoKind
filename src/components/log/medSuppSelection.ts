// Med/supp selection state for the Log tab, as a pure reducer.
// This was four useState hooks plus intertwined toggle handlers in LogScreen;
// the edit-mode locking (a single entry stays single: the other section is
// locked while editing) is subtle enough to deserve one state machine instead
// of scattered setters. Pure — no React Native imports — so it's unit-tested
// directly (src/medSuppSelection.test.ts).

export interface MedSuppSelectionState {
  selectedMedIds: number[];
  selectedSuppIds: number[];
  /** "How many" per selected item (only used for as-needed items). */
  medQty: Record<number, number>;
  suppQty: Record<number, number>;
}

export const initialMedSuppSelection: MedSuppSelectionState = {
  selectedMedIds: [],
  selectedSuppIds: [],
  medQty: {},
  suppQty: {},
};

/** Which single entry (if any) is loaded into the form for editing. */
export type EditingKind = 'medication' | 'supplement' | null;

export type MedSuppSelectionAction =
  | { type: 'toggle-med'; id: number; editingKind: EditingKind }
  | { type: 'toggle-supp'; id: number; editingKind: EditingKind }
  | { type: 'bump-qty'; kind: 'med' | 'supp'; id: number; delta: number }
  /** Drop selections whose profile entry no longer exists. */
  | { type: 'prune'; validMedIds: number[]; validSuppIds: number[] }
  /** Load an existing entry into the form for editing. */
  | {
      type: 'load-selection';
      medIds: number[];
      suppIds: number[];
      medQty: Record<number, number>;
      suppQty: Record<number, number>;
    }
  | { type: 'reset' };

/** Toggle an id in a multi-select list. */
function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function toggleMed(
  state: MedSuppSelectionState,
  id: number,
  editingKind: EditingKind,
): MedSuppSelectionState {
  // In edit mode the other section is locked so a single entry stays single.
  if (editingKind === 'supplement') return state;
  if (editingKind === 'medication') {
    return {
      ...state,
      selectedMedIds: [id],
      medQty: { ...state.medQty, [id]: state.medQty[id] ?? 1 },
    };
  }
  const isOn = state.selectedMedIds.includes(id);
  let medQty: Record<number, number>;
  if (!isOn) {
    medQty = { ...state.medQty, [id]: state.medQty[id] ?? 1 };
  } else {
    const { [id]: _dropped, ...rest } = state.medQty;
    medQty = rest;
  }
  return { ...state, selectedMedIds: toggleId(state.selectedMedIds, id), medQty };
}

function toggleSupp(
  state: MedSuppSelectionState,
  id: number,
  editingKind: EditingKind,
): MedSuppSelectionState {
  if (editingKind === 'medication') return state;
  if (editingKind === 'supplement') {
    return {
      ...state,
      selectedSuppIds: [id],
      suppQty: { ...state.suppQty, [id]: state.suppQty[id] ?? 1 },
    };
  }
  const isOn = state.selectedSuppIds.includes(id);
  let suppQty: Record<number, number>;
  if (!isOn) {
    suppQty = { ...state.suppQty, [id]: state.suppQty[id] ?? 1 };
  } else {
    const { [id]: _dropped, ...rest } = state.suppQty;
    suppQty = rest;
  }
  return { ...state, selectedSuppIds: toggleId(state.selectedSuppIds, id), suppQty };
}

export function medSuppSelectionReducer(
  state: MedSuppSelectionState,
  action: MedSuppSelectionAction,
): MedSuppSelectionState {
  switch (action.type) {
    case 'toggle-med':
      return toggleMed(state, action.id, action.editingKind);
    case 'toggle-supp':
      return toggleSupp(state, action.id, action.editingKind);
    case 'bump-qty': {
      const key = action.kind === 'med' ? 'medQty' : 'suppQty';
      const q = state[key];
      return {
        ...state,
        [key]: { ...q, [action.id]: Math.min(20, Math.max(1, (q[action.id] ?? 1) + action.delta)) },
      };
    }
    case 'prune':
      return {
        ...state,
        selectedMedIds: state.selectedMedIds.filter((id) => action.validMedIds.includes(id)),
        selectedSuppIds: state.selectedSuppIds.filter((id) => action.validSuppIds.includes(id)),
      };
    case 'load-selection':
      return {
        selectedMedIds: action.medIds,
        selectedSuppIds: action.suppIds,
        medQty: action.medQty,
        suppQty: action.suppQty,
      };
    case 'reset':
      return initialMedSuppSelection;
  }
}
