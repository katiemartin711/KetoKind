// Shared delete-confirm Alert used by Log (today's entries) and LogList.

import { Alert } from 'react-native';

/** Confirm before deleting a log entry. `onConfirm` runs only on Delete. */
export function confirmDeleteEntry(title: string, onConfirm: () => void): void {
  Alert.alert('Delete entry?', `"${title}" will be removed.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
