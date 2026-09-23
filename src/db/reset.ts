// Shared last-resort recovery: close the open handle, delete the db file,
// and re-init. Used by App.tsx's startup error screen and TabErrorBoundary
// so the wipe path can't drift between the two.

import { deleteDatabaseSync } from 'expo-sqlite';
import { closeDatabase } from './client';
import { initDb } from './schema';

/** Wipe the on-device database file and recreate an empty schema. */
export function resetLocalDatabase(): void {
  // Close first: the file can't be deleted while open, and a stale handle
  // would keep writing to the deleted inode.
  closeDatabase();
  deleteDatabaseSync('ketokind.db');
  initDb();
}
