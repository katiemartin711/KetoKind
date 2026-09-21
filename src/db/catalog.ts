// Profile lists: allergies, health conditions, medications, supplements.
import { database } from './client';
import type { Allergy, Condition, Medication, Supplement } from '../types';

export function listAllergies(): Allergy[] {
  return database().getAllSync<Allergy>('SELECT * FROM allergies ORDER BY name');
}

export function addAllergy(name: string): void {
  database().runSync('INSERT INTO allergies (name) VALUES (?)', [name.trim()]);
}

export function deleteAllergy(id: number): void {
  database().runSync('DELETE FROM allergies WHERE id = ?', [id]);
}

export function listConditions(): Condition[] {
  return database().getAllSync<Condition>('SELECT * FROM conditions ORDER BY name');
}

export function addCondition(name: string): void {
  database().runSync('INSERT INTO conditions (name) VALUES (?)', [name.trim()]);
}

export function deleteCondition(id: number): void {
  database().runSync('DELETE FROM conditions WHERE id = ?', [id]);
}

export function listMedications(): Medication[] {
  return database().getAllSync<Medication>('SELECT * FROM medications ORDER BY name');
}

export function addMedication(
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'INSERT INTO medications (name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0],
  );
}

export function deleteMedication(id: number): void {
  database().runSync('DELETE FROM medications WHERE id = ?', [id]);
}

export function updateMedication(
  id: number,
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'UPDATE medications SET name = ?, dosage = ?, times_per_day = ?, purpose = ?, as_needed = ? WHERE id = ?',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0, id],
  );
}

export function listSupplements(): Supplement[] {
  return database().getAllSync<Supplement>('SELECT * FROM supplements ORDER BY name');
}

export function addSupplement(
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'INSERT INTO supplements (name, dosage, times_per_day, purpose, as_needed) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0],
  );
}

export function deleteSupplement(id: number): void {
  database().runSync('DELETE FROM supplements WHERE id = ?', [id]);
}

export function updateSupplement(
  id: number,
  name: string,
  dosage: string,
  timesPerDay: number,
  purpose: string,
  asNeeded: boolean,
): void {
  database().runSync(
    'UPDATE supplements SET name = ?, dosage = ?, times_per_day = ?, purpose = ?, as_needed = ? WHERE id = ?',
    [name.trim(), dosage.trim(), timesPerDay, purpose.trim(), asNeeded ? 1 : 0, id],
  );
}
