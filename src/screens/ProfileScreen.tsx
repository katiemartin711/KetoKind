// Profile tab: diet type, personal diet nuances, goals, and editable lists
// for allergies, health conditions, and medications. Everything here feeds
// the AI context file generated on the AI Coach tab.
//
// The tab is composed of focused section components (src/components/profile/)
// and focused state hooks (useDietAboutForm, useWeightSettings,
// useSimpleLists, useMedSuppManager, useBackupActions); this file only
// composes them.

import React, { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { deleteAllData, getProfile, getProStatus, getTrackCalories, setProStatus, setTrackCalories } from '../db/profile';
import { TEST_MODE_PURCHASE } from '../pro';
import { deleteOnDeviceModel, downloadOnDeviceModel, isModelReady, isNativeLlmLinked } from '../llm/engine';
import type { DatabaseBackup } from '../db/backup';
import { useTheme } from '../ThemeContext';
import KeyboardScrollView from '../components/KeyboardScrollView';
import DietSection from '../components/profile/DietSection';
import AboutSection from '../components/profile/AboutSection';
import WeightSection from '../components/profile/WeightSection';
import OnDeviceSection from '../components/profile/OnDeviceSection';
import AppearanceSection from '../components/profile/AppearanceSection';
import NotificationSection from '../components/profile/NotificationSection';
import SimpleListSection from '../components/profile/SimpleListSection';
import MedSuppSection from '../components/profile/MedSuppSection';
import BackupSection from '../components/profile/BackupSection';
import DangerSection from '../components/profile/DangerSection';
import ProSection from '../components/profile/ProSection';
import TestingSection from '../components/profile/TestingSection';
import PaywallModal from '../components/PaywallModal';
import { useDietAboutForm } from '../components/profile/useDietAboutForm';
import { useWeightSettings } from '../components/profile/useWeightSettings';
import { useSimpleLists } from '../components/profile/useSimpleLists';
import { useMedSuppManager } from '../components/profile/useMedSuppManager';
import { useBackupActions } from '../components/profile/useBackupActions';

export default function ProfileScreen() {
  const { common, setMode: setAppTheme } = useTheme();
  const dietAbout = useDietAboutForm();
  const weightSettings = useWeightSettings();
  const lists = useSimpleLists();
  const medSupp = useMedSuppManager();
  const backup = useBackupActions();
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [trackCalories, setTrackCaloriesOn] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const refresh = useCallback(() => {
    const p = getProfile();
    dietAbout.load(p);
    weightSettings.load(p);
    lists.load();
    medSupp.load();
    setIsPro(getProStatus());
    setTrackCaloriesOn(getTrackCalories());
    setModelReady(isModelReady());
  }, [dietAbout.load, weightSettings.load, lists.load, medSupp.load]);

  useFocusEffect(refresh);

  /** Testing toggle: flip the Pro flag instantly, no purchase. */
  const togglePro = (value: boolean) => {
    setProStatus(value);
    setIsPro(value);
  };

  const confirmDeleteAllData = () => {
    Alert.alert(
      'Delete all data?',
      'This permanently deletes your profile, logs, medications, supplements, and weight history on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            deleteAllData();
            medSupp.clearMedSuppForm();
            setAppTheme('system'); // delete-all resets the theme too
            refresh();
            Alert.alert('Done', 'All data has been deleted from this device.');
          },
        },
      ],
    );
  };

  /** After a backup import: clear the med/supp form, reload everything,
   *  and apply the backup's theme. */
  const onBackupImported = (b: DatabaseBackup) => {
    medSupp.clearMedSuppForm();
    refresh();
    const mode = b.profile.theme_mode;
    setAppTheme(mode === 'light' || mode === 'dark' ? mode : 'system');
    Alert.alert('Done', 'Backup imported successfully.');
  };

  return (
    <>
      <KeyboardScrollView>
        <Text style={common.h1}>Profile</Text>
        <Text style={common.subtitle}>
          This is what gets included in your AI coach context file.
        </Text>

        <ProSection isPro={isPro} onPress={() => setPaywallVisible(true)} />

        <AboutSection
          name={dietAbout.name}
          onNameChange={dietAbout.setName}
          age={dietAbout.age}
          onAgeChange={dietAbout.setAge}
          sex={dietAbout.sex}
          onSexChange={dietAbout.setSex}
          bio={dietAbout.bio}
          onBioChange={dietAbout.setBio}
        />

        <DietSection
          dietType={dietAbout.dietType}
          infoDiet={dietAbout.infoDiet}
          onSelectDiet={dietAbout.selectDiet}
          onToggleInfo={dietAbout.toggleDietInfo}
          nuances={dietAbout.nuances}
          onNuancesChange={dietAbout.setNuances}
          goals={dietAbout.goals}
          onGoalsChange={dietAbout.setGoals}
          dietStart={dietAbout.dietStart}
          onDietStartChange={dietAbout.updateDietStart}
          savedDietStart={dietAbout.savedDietStart}
          savedDietType={dietAbout.savedDietType}
          savedFlash={dietAbout.savedFlash}
          onSave={dietAbout.onSave}
        />

        <OnDeviceSection
          trackCalories={trackCalories}
          onTrackCaloriesChange={(on) => {
            setTrackCalories(on);
            setTrackCaloriesOn(on);
          }}
          nativeAvailable={isNativeLlmLinked()}
          modelReady={modelReady}
          downloading={downloading}
          progress={downloadProgress}
          onDownload={() => {
            if (downloading) return;
            setDownloading(true);
            setDownloadProgress(0);
            void downloadOnDeviceModel((fraction) => setDownloadProgress(fraction))
              .then(() => setModelReady(isModelReady()))
              .catch(() => {
                Alert.alert("Couldn't download", 'Check your connection and try again. Logging still works without the model.');
              })
              .finally(() => {
                setDownloading(false);
                setDownloadProgress(null);
              });
          }}
          onDeleteModel={() => {
            Alert.alert('Remove the on-device model?', 'Meal estimates stop until you download it again. Meals you already saved stay.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                  void deleteOnDeviceModel().then(() => setModelReady(false));
                },
              },
            ]);
          }}
        />

        <WeightSection
          trackWeight={weightSettings.trackWeight}
          onTrackWeightChange={weightSettings.setTrackWeight}
          startingWeight={weightSettings.startingWeight}
          onStartingWeightChange={weightSettings.setStartingWeight}
          savedFlash={weightSettings.weightSavedFlash}
          onSave={weightSettings.saveWeightSettings}
        />

        <AppearanceSection />

        <NotificationSection />

        <SimpleListSection
          title="Allergies"
          items={lists.allergies}
          inputValue={lists.allergyInput}
          onInputChange={lists.setAllergyInput}
          inputPlaceholder="Add allergy"
          onAdd={lists.addAllergyRow}
          onDelete={lists.deleteAllergyRow}
        />

        <SimpleListSection
          title="Health conditions"
          items={lists.conditions}
          inputValue={lists.conditionInput}
          onInputChange={lists.setConditionInput}
          inputPlaceholder="Add condition"
          onAdd={lists.addConditionRow}
          onDelete={lists.deleteConditionRow}
        />

        <MedSuppSection
          tab={medSupp.medSuppTab}
          onTabChange={medSupp.changeTab}
          medications={medSupp.medications}
          supplements={medSupp.supplements}
          editingEntry={medSupp.editingEntry}
          form={medSupp.medSuppForm}
          onFormChange={medSupp.patchForm}
          onSave={medSupp.saveMedSuppRow}
          onCancelEdit={medSupp.clearMedSuppForm}
          onStartEdit={medSupp.startEditMedSupp}
          onDeleteMedication={medSupp.deleteMedicationRow}
          onDeleteSupplement={medSupp.deleteSupplementRow}
        />

        <BackupSection
          onDownload={isPro ? backup.downloadBackup : () => setPaywallVisible(true)}
          onImport={isPro ? () => backup.importBackupFile(onBackupImported) : () => setPaywallVisible(true)}
          locked={!isPro}
        />

        <DangerSection onDelete={confirmDeleteAllData} />

        {/* Hidden on production builds, where TEST_MODE_PURCHASE is false. */}
        {TEST_MODE_PURCHASE && <TestingSection isPro={isPro} onToggle={togglePro} />}
      </KeyboardScrollView>
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onUnlocked={() => setIsPro(getProStatus())}
      />
    </>
  );
}
