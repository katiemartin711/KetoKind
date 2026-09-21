// Pure validation for the Profile tab's save action.
//
// Extracted from ProfileScreen.onSave so the rules are unit-testable without a
// React Native runtime. The messages must stay identical to the Alert text the
// screen shows; the component maps a failure to Alert.alert('Invalid', message).
import { parseIntStrict } from './numberParsing';
import { toDietStartString } from './milestones';

export interface DietStartInput {
  month: string;
  day: string;
  year: string;
}

export type ProfileValidationResult =
  | { ok: true; age: number | null; dietStart: string | null }
  | { ok: false; message: string };

/**
 * Validate the profile form's free-text numeric fields.
 * Returns the parsed age (null when blank) and diet-start string (null when
 * blank), or the first user-facing error message.
 */
export function validateProfileInputs(
  age: string,
  dietStart: DietStartInput,
): ProfileValidationResult {
  let ageNum: number | null = null;
  if (age.trim() !== '') {
    const n = parseIntStrict(age);
    if (n == null || n < 1 || n > 120) {
      return {
        ok: false,
        message: 'Age must be a whole number between 1 and 120, or leave it blank.',
      };
    }
    ageNum = n;
  }
  // Diet start date: month + year required, day optional. Blank = not set.
  let dietStartValue: string | null = null;
  const mStr = dietStart.month.trim();
  const dStr = dietStart.day.trim();
  const yStr = dietStart.year.trim();
  if (mStr !== '' || dStr !== '' || yStr !== '') {
    const nowYear = new Date().getFullYear();
    if (mStr === '' || yStr === '') {
      return {
        ok: false,
        message:
          'Enter at least the month and year you started your diet, or leave all three blank.',
      };
    }
    const month = parseIntStrict(mStr);
    const year = parseIntStrict(yStr);
    if (month == null || month < 1 || month > 12) {
      return { ok: false, message: 'Diet start month must be between 1 and 12.' };
    }
    if (year == null || year < 1990 || year > nowYear) {
      return {
        ok: false,
        message: `Diet start year must be between 1990 and ${nowYear}.`,
      };
    }
    let day: number | null = null;
    if (dStr !== '') {
      day = parseIntStrict(dStr);
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day == null || day < 1 || day > daysInMonth) {
        return {
          ok: false,
          message: `Diet start day must be between 1 and ${daysInMonth} for that month.`,
        };
      }
    }
    const start = new Date(year, month - 1, day ?? 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start.getTime() > today.getTime()) {
      return { ok: false, message: 'Your diet start date can’t be in the future.' };
    }
    dietStartValue = toDietStartString(year, month, day);
  }
  return { ok: true, age: ageNum, dietStart: dietStartValue };
}
