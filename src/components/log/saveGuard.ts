export interface SaveDraft<T> {
  saving: boolean;
  value: T;
}

export function beginSave<T>(draft: SaveDraft<T>, empty: T): { ok: true; value: T } | { ok: false } {
  if (draft.saving) return { ok: false };
  const value = draft.value;
  draft.saving = true;
  draft.value = empty;
  return { ok: true, value };
}

export function finishSave<T>(draft: SaveDraft<T>, restore: T | null): void {
  draft.saving = false;
  if (restore !== null) draft.value = restore;
}
