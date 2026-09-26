// Backup export/import actions for the Profile tab. After a successful import
// the caller-provided `onImported` runs so the screen can refresh its state.
// The backup JSON and the document-picker cache copy are deleted after use.

import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  exportBackup,
  importBackup,
  isDatabaseBackup,
  MAX_BACKUP_BYTES,
  validateBackup,
} from '../../db/backup';
import type { DatabaseBackup } from '../../db/backup';
import { IMPORT_BODY } from '../../destructiveCopy';

function deleteFile(file: File) {
  try {
    file.delete();
  } catch {
    /* already gone */
  }
}

export function useBackupActions() {
  const downloadBackup = async () => {
    try {
      const backup = exportBackup();
      if (validateBackup(backup).length > 0) {
        Alert.alert('Backup failed');
        return;
      }
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const file = new File(Paths.cache, `ketokind-backup-${stamp}.json`);
      try {
        file.write(JSON.stringify(backup));
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
      } finally {
        try { file.delete(); } catch { /* already gone */ }
      }
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Could not create the backup file.');
    }
  };

  const importBackupFile = async (onImported: (backup: DatabaseBackup) => void) => {
    let cached: File | null = null;
    const deleteCached = () => {
      if (!cached) return;
      const file = cached;
      cached = null;
      deleteFile(file);
    };
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) return;
      cached = new File(uri);
      if (cached.size > MAX_BACKUP_BYTES) {
        Alert.alert('Invalid file', 'That backup is too large to import.');
        deleteCached();
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(await cached.text());
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
        deleteCached();
        return;
      }
      const backup = parsed;
      Alert.alert(
        'Replace all data?',
        IMPORT_BODY,
        [
          { text: 'Cancel', style: 'cancel', onPress: deleteCached },
          {
            text: 'Import',
            style: 'destructive',
            onPress: () => {
              try {
                importBackup(backup);
                onImported(backup);
              } catch (e) {
                Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not import the backup.');
              } finally {
                deleteCached();
              }
            },
          },
        ],
      );
    } catch (e) {
      deleteCached();
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not read the file.');
    }
  };

  return { downloadBackup, importBackupFile };
}
