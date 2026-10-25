import { Trip } from '../domain/trips/trip.types';
import { validateTrip } from '../domain/trips/trip.validation';
import { SAMPLE_TRIP, DEMO_TRIP_ID } from './demo-data';

export const STORAGE_KEYS = {
  TRIPS: 'altravel_trips_v1',
  ACTIVE_TRIP_ID: 'altravel_active_trip_id_v1',
} as const;

/**
 * Safely accesses window.localStorage with fallback when unavailable (SSR or restricted environments).
 */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const testKey = '__altravel_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (error) {
    console.warn('[ALTravel Storage] LocalStorage is not accessible:', error);
    return null;
  }
}

/**
 * Loads all trips from localStorage.
 * Gracefully parses JSON and validates schema, discarding corrupt entries while keeping valid ones.
 */
export function loadTrips(): Trip[] {
  const storage = getStorage();
  if (!storage) return [];

  const raw = storage.getItem(STORAGE_KEYS.TRIPS);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[ALTravel Storage] Stored data is not an array, resetting to empty.');
      return [];
    }

    const validTrips: Trip[] = [];
    for (const item of parsed) {
      const result = validateTrip(item);
      if (result.success && result.data) {
        validTrips.push(result.data);
      } else {
        console.warn('[ALTravel Storage] Discarding invalid trip entry:', result.errors);
      }
    }
    return validTrips;
  } catch (error) {
    console.warn('[ALTravel Storage] Corrupted JSON in localStorage. Returning empty list.', error);
    return [];
  }
}

/**
 * Persists an array of trips into localStorage.
 */
export function saveTrips(trips: Trip[]): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
    return true;
  } catch (error) {
    console.error('[ALTravel Storage] Failed to save trips to localStorage:', error);
    return false;
  }
}

/**
 * Retrieves a single trip by ID.
 */
export function getTripById(id: string): Trip | null {
  const trips = loadTrips();
  return trips.find((t) => t.id === id) ?? null;
}

/**
 * Upserts a trip into the stored collection.
 */
export function upsertTrip(trip: Trip): boolean {
  const validation = validateTrip(trip);
  if (!validation.success || !validation.data) {
    console.error('[ALTravel Storage] Cannot save invalid trip:', validation.errors);
    return false;
  }

  const trips = loadTrips();
  const existingIndex = trips.findIndex((t) => t.id === trip.id);

  if (existingIndex >= 0) {
    trips[existingIndex] = {
      ...validation.data,
      updatedAt: new Date().toISOString(),
    };
  } else {
    trips.unshift(validation.data);
  }

  return saveTrips(trips);
}

/**
 * Removes a trip from localStorage by its ID.
 */
export function deleteTrip(id: string): boolean {
  const trips = loadTrips();
  const filtered = trips.filter((t) => t.id !== id);
  const saved = saveTrips(filtered);

  if (getActiveTripId() === id) {
    setActiveTripId(filtered[0]?.id ?? null);
  }

  return saved;
}

export interface LoadSampleTripResult {
  success: boolean;
  trip: Trip;
}

/**
 * Loads or reloads the sample trip into localStorage and selects it if saved successfully.
 * Explicitly exposes the persistence outcome to the caller.
 */
export function loadSampleTrip(): LoadSampleTripResult {
  const trips = loadTrips();
  const existingIndex = trips.findIndex((t) => t.id === DEMO_TRIP_ID);

  if (existingIndex >= 0) {
    trips[existingIndex] = SAMPLE_TRIP;
  } else {
    trips.unshift(SAMPLE_TRIP);
  }

  const saved = saveTrips(trips);
  if (saved) {
    setActiveTripId(DEMO_TRIP_ID);
  }
  return {
    success: saved,
    trip: SAMPLE_TRIP,
  };
}

/**
 * Gets the currently selected active trip ID from localStorage.
 */
export function getActiveTripId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return storage.getItem(STORAGE_KEYS.ACTIVE_TRIP_ID);
}

/**
 * Sets or clears the active trip ID in localStorage.
 */
export function setActiveTripId(id: string | null): void {
  const storage = getStorage();
  if (!storage) return;

  if (id === null) {
    storage.removeItem(STORAGE_KEYS.ACTIVE_TRIP_ID);
  } else {
    storage.setItem(STORAGE_KEYS.ACTIVE_TRIP_ID, id);
  }
}

/**
 * Clears ALTravel-specific keys from storage without wiping unrelated browser storage.
 */
export function resetALTravelStorage(): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(STORAGE_KEYS.TRIPS);
  storage.removeItem(STORAGE_KEYS.ACTIVE_TRIP_ID);
}
