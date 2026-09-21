// Backup export/import actions for the Profile tab. The Expo file calls
// (document picker, expo-file-system, sharing) are moved verbatim — no new
// Expo API usage. After a successful import the caller-provided `onImported`
// runs so the screen can refresh its state.

import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  exportBackup,
  importBackup,
  isDatabaseBackup,
  validateBackup,
} from '../../db/backup';
import type { DatabaseBackup } from '../../db/backup';

export function useBackupActions() {
  const downloadBackup = async () => {
    try {
      const backup = exportBackup();
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const file = new File(Paths.document, `ketokind-backup-${stamp}.json`);
      file.write(JSON.stringify(backup));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Could not create the backup file.');
    }
  };

  const importBackupFile = async (onImported: (backup: DatabaseBackup) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(await new File(uri).text());
      } catch {
        parsed = null;
      }
      if (!isDatabaseBackup(parsed)) {
        const [firstIssue] = validateBackup(parsed);
        Alert.alert(
          'Invalid file',
          firstIssue
            ? `That file is not a valid KetoKind backup: ${firstIssue.path} — ${firstIssue.message}`
            : 'That file is not a valid KetoKind backup.',
        );
        return;
      }
      const backup = parsed;
      Alert.alert(
        'Replace all data?',
        'Importing will replace everything currently on this device with the backup. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: () => {
              try {
                importBackup(backup);
                onImported(backup);
              } catch (e) {
                Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import the backup.');
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not read the file.');
    }
  };

  return { downloadBackup, importBackupFile };
}
