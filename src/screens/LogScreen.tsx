// Log tab: segmented forms for Meal / Meds & Supps / Symptom / Weight,
// plus today's entries across all types with edit and delete on each.
//
// The tab is composed of focused form components (src/components/log/);
// the tab's state machine lives in useLogScreen — this file only composes
// the pieces.

import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../ThemeContext';
import KeyboardScrollView from '../components/KeyboardScrollView';
import MealForm from '../components/log/MealForm';
import MedSuppForm from '../components/log/MedSuppForm';
import SegmentTabs from '../components/log/SegmentTabs';
import SymptomForm from '../components/log/SymptomForm';
import WeightForm from '../components/log/WeightForm';
import TodayEntries from '../components/log/TodayEntries';
import { useLogScreen } from '../components/log/useLogScreen';

export default function LogScreen() {
  const { common } = useTheme();
  const s = useLogScreen();

  return (
    <KeyboardScrollView>
      <Text style={common.h1}>Log</Text>
      <Text style={common.subtitle}>What did you eat, take, or feel?</Text>

      <SegmentTabs segments={s.visibleSegments} active={s.segment} onSelect={s.selectSegment} />

      {s.segment === 'meal' && (
        <MealForm
          mealName={s.mealName}
          onMealNameChange={s.setMealName}
          mealType={s.mealType}
          onMealTypeChange={s.setMealType}
          mealNotes={s.mealNotes}
          onMealNotesChange={s.setMealNotes}
          logDate={s.logDate}
          onLogDateChange={s.setLogDate}
          editing={s.editing?.kind === 'meal'}
          onSave={s.saveMeal}
          onCancel={s.resetForm}
          trackCalories={s.trackCalories}
          protein={s.macroProtein}
          fat={s.macroFat}
          carbs={s.macroCarbs}
          fiber={s.macroFiber}
          calories={s.macroCalories}
          onProteinChange={s.setMacroProtein}
          onFatChange={s.setMacroFat}
          onCarbsChange={s.setMacroCarbs}
          onFiberChange={s.setMacroFiber}
          onCaloriesChange={s.setMacroCalories}
          estimating={s.estimating}
          favorite={s.favorite}
          onFavoriteChange={s.setFavorite}
          favorites={s.favorites}
          onUseFavorite={s.useFavorite}
          onRemoveFavorite={s.removeFavorite}
        />
      )}

      {s.segment === 'medsupp' && (
        <MedSuppForm
          medications={s.medications}
          profileSupps={s.profileSupps}
          selectedMedIds={s.sel.selectedMedIds}
          selectedSuppIds={s.sel.selectedSuppIds}
          medQty={s.sel.medQty}
          suppQty={s.sel.suppQty}
          onToggleMed={s.onToggleMed}
          onToggleSupp={s.onToggleSupp}
          onBumpQty={s.bumpQty}
          logDate={s.logDate}
          onLogDateChange={s.setLogDate}
          editingKind={s.editingKind}
          onSave={s.saveMedSupp}
          onCancel={s.resetForm}
        />
      )}

      {s.segment === 'symptom' && (
        <SymptomForm
          symptomName={s.symptomName}
          onSymptomNameChange={s.setSymptomName}
          priorNames={s.priorSymptomNames}
          severity={s.severity}
          onSeverityChange={s.setSeverity}
          symptomNotes={s.symptomNotes}
          onSymptomNotesChange={s.setSymptomNotes}
          logDate={s.logDate}
          onLogDateChange={s.setLogDate}
          editing={s.editing?.kind === 'symptom'}
          onSave={s.saveSymptom}
          onCancel={s.resetForm}
        />
      )}

      {s.segment === 'weight' && (
        <WeightForm
          weightInput={s.weightInput}
          onWeightInputChange={s.setWeightInput}
          logDate={s.logDate}
          onLogDateChange={s.setLogDate}
          editing={s.editing?.kind === 'weight'}
          onSave={s.saveWeight}
          onCancel={s.resetForm}
        />
      )}

      <TodayEntries logs={s.todayLogs} onEdit={s.startEdit} onDelete={s.confirmDelete} />
    </KeyboardScrollView>
  );
}
