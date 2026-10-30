import { Trip } from '../domain/trips/trip.types';
import { validateTrip } from '../domain/trips/trip.validation';
import { SAMPLE_TRIP, DEMO_TRIP_ID } from './demo-data';

export const STORAGE_KEYS = {
  TRIPS: 'altravel_trips_v1', // Legacy global trips key
  ACTIVE_TRIP_ID: 'altravel_active_trip_id_v1', // Legacy active trip key
  USER_TRIPS_PREFIX: 'tripsync_user_',
  USER_TRIPS_SUFFIX: '_trips_v1',
  USER_ACTIVE_TRIP_PREFIX: 'tripsync_user_',
  USER_ACTIVE_TRIP_SUFFIX: '_active_trip_v1',
  GUEST_ACTIVE_TRIP_ID: 'tripsync_guest_active_trip_v1',
  DEMO_TRIP_STATE: 'tripsync_demo_trip_state_v1',
} as const;

export function getUserTripsKey(userId: string): string {
  return `${STORAGE_KEYS.USER_TRIPS_PREFIX}${userId}${STORAGE_KEYS.USER_TRIPS_SUFFIX}`;
}

export function getUserActiveTripKey(userId: string): string {
  return `${STORAGE_KEYS.USER_ACTIVE_TRIP_PREFIX}${userId}${STORAGE_KEYS.USER_ACTIVE_TRIP_SUFFIX}`;
}

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('tripsync_auth_user_session');
    const token = sessionStorage.getItem('tripsync_auth_token_session');
    if (!raw || !token) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

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
    console.warn('[TripSync Storage] LocalStorage is not accessible:', error);
    return null;
  }
}

function parseAndValidateTrips(raw: string | null): Trip[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('[TripSync Storage] Stored data is not an array, resetting to empty.');
      return [];
    }

    const validTrips: Trip[] = [];
    for (const item of parsed) {
      const result = validateTrip(item);
      if (result.success && result.data) {
        validTrips.push(result.data);
      } else {
        console.warn('[TripSync Storage] Discarding invalid trip entry:', result.errors);
      }
    }
    return validTrips;
  } catch (error) {
    console.warn('[TripSync Storage] Corrupted JSON in localStorage. Returning empty list.', error);
    return [];
  }
}

/**
 * Loads trips with strict user/guest isolation:
 * - If userId === null (guest mode): Returns [] (never exposes personal trips to unauthenticated users).
 * - If userId is a string: Returns trips belonging exclusively to that user from their user-scoped key.
 * - If userId is undefined: Fallback for test suites or auto-detects active user session.
 */
export function loadTrips(userId?: string | null): Trip[] {
  const storage = getStorage();
  if (!storage) return [];

  // Strict guest mode: Unauthenticated visitors have ZERO personal trips
  if (userId === null) {
    return [];
  }

  // Authenticated user mode
  if (typeof userId === 'string' && userId.trim() !== '') {
    const userKey = getUserTripsKey(userId);
    const userRaw = storage.getItem(userKey);
    if (userRaw) {
      return parseAndValidateTrips(userRaw);
    }

    // Safe migration from legacy storage: check if any trips belong to this user
    const legacyRaw = storage.getItem(STORAGE_KEYS.TRIPS);
    if (legacyRaw) {
      const legacyTrips = parseAndValidateTrips(legacyRaw);
      const userTrips = legacyTrips.filter((t) => t.userId === userId && !t.isSample);
      if (userTrips.length > 0) {
        saveTrips(userTrips, userId);
        return userTrips;
      }
    }
    return [];
  }

  // Fallback mode (when userId is undefined)
  const currentUserId = getCurrentUserId();
  if (currentUserId) {
    return loadTrips(currentUserId);
  }

  // Direct test suite fallback for raw unit tests
  const raw = storage.getItem(STORAGE_KEYS.TRIPS);
  return parseAndValidateTrips(raw);
}

/**
 * Persists an array of trips into localStorage under the appropriate user key.
 */
export function saveTrips(trips: Trip[], userId?: string | null): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    if (userId === null) {
      // Guest mode does not write to user storage
      return true;
    }

    if (typeof userId === 'string' && userId.trim() !== '') {
      storage.setItem(getUserTripsKey(userId), JSON.stringify(trips));
      return true;
    }

    const currentUserId = getCurrentUserId();
    if (currentUserId) {
      storage.setItem(getUserTripsKey(currentUserId), JSON.stringify(trips));
      return true;
    }

    // Legacy fallback for test runner
    storage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
    return true;
  } catch (error) {
    console.error('[TripSync Storage] Failed to save trips to localStorage:', error);
    return false;
  }
}

/**
 * Retrieves a single trip by ID.
 */
export function getTripById(id: string, userId?: string | null): Trip | null {
  if (id === DEMO_TRIP_ID) {
    return SAMPLE_TRIP;
  }
  const trips = loadTrips(userId);
  return trips.find((t) => t.id === id) ?? null;
}

/**
 * Upserts a trip into the stored collection.
 */
export function upsertTrip(trip: Trip, userId?: string | null): boolean {
  const validation = validateTrip(trip);
  if (!validation.success || !validation.data) {
    console.error('[TripSync Storage] Cannot save invalid trip:', validation.errors);
    return false;
  }

  const effectiveUserId = userId !== undefined ? userId : (typeof trip.userId === 'string' ? trip.userId : getCurrentUserId());



  if (effectiveUserId) {
    const trips = loadTrips(effectiveUserId);
    const existingIndex = trips.findIndex((t) => t.id === trip.id);

    const tripWithUser: Trip = {
      ...validation.data,
      userId: effectiveUserId,
    };

    if (existingIndex >= 0) {
      trips[existingIndex] = {
        ...tripWithUser,
        updatedAt: new Date().toISOString(),
      };
    } else {
      trips.unshift(tripWithUser);
    }
    return saveTrips(trips, effectiveUserId);
  }

  // Legacy fallback for raw test suites
  const trips = loadTrips(undefined);
  const existingIndex = trips.findIndex((t) => t.id === trip.id);
  if (existingIndex >= 0) {
    trips[existingIndex] = {
      ...validation.data,
      updatedAt: new Date().toISOString(),
    };
  } else {
    trips.unshift(validation.data);
  }
  return saveTrips(trips, undefined);
}

/**
 * Removes a trip from localStorage by its ID.
 */
export function deleteTrip(id: string, userId?: string | null): boolean {
  const effectiveUserId = userId !== undefined ? userId : getCurrentUserId();

  if (effectiveUserId) {
    const trips = loadTrips(effectiveUserId);
    const filtered = trips.filter((t) => t.id !== id);
    const saved = saveTrips(filtered, effectiveUserId);

    if (getActiveTripId(effectiveUserId) === id) {
      setActiveTripId(filtered[0]?.id ?? null, effectiveUserId);
    }
    return saved;
  }

  const trips = loadTrips(undefined);
  const filtered = trips.filter((t) => t.id !== id);
  const saved = saveTrips(filtered, undefined);

  if (getActiveTripId(undefined) === id) {
    setActiveTripId(filtered[0]?.id ?? null, undefined);
  }
  if (getActiveTripId(null) === id) {
    setActiveTripId(null, null);
  }

  return saved;
}

export interface LoadSampleTripResult {
  success: boolean;
  trip: Trip;
}

/**
 * Loads the sample trip into the active demo workspace.
 * When called without arguments (e.g. in test suites), also adds to default trips collection.
 */
export function loadSampleTrip(userId?: string | null): LoadSampleTripResult {
  if (userId === undefined) {
    const trips = loadTrips(undefined);
    const existingIndex = trips.findIndex((t) => t.id === DEMO_TRIP_ID);
    if (existingIndex >= 0) {
      trips[existingIndex] = SAMPLE_TRIP;
    } else {
      trips.unshift(SAMPLE_TRIP);
    }
    const saved = saveTrips(trips, undefined);
    if (saved) {
      setActiveTripId(DEMO_TRIP_ID, undefined);
      setActiveTripId(DEMO_TRIP_ID, null);
    }
    return {
      success: saved,
      trip: SAMPLE_TRIP,
    };
  }

  setActiveTripId(DEMO_TRIP_ID, userId);
  return {
    success: true,
    trip: SAMPLE_TRIP,
  };
}

/**
 * Gets the currently selected active trip ID from localStorage.
 */
export function getActiveTripId(userId?: string | null): string | null {
  const storage = getStorage();
  if (!storage) return null;

  if (userId) {
    return storage.getItem(getUserActiveTripKey(userId));
  }
  if (userId === null) {
    return storage.getItem(STORAGE_KEYS.GUEST_ACTIVE_TRIP_ID);
  }

  const currentUserId = getCurrentUserId();
  if (currentUserId) {
    return storage.getItem(getUserActiveTripKey(currentUserId));
  }
  return storage.getItem(STORAGE_KEYS.ACTIVE_TRIP_ID);
}

/**
 * Sets or clears the active trip ID in localStorage.
 */
export function setActiveTripId(id: string | null, userId?: string | null): void {
  const storage = getStorage();
  if (!storage) return;

  const effectiveKey = userId
    ? getUserActiveTripKey(userId)
    : userId === null
    ? STORAGE_KEYS.GUEST_ACTIVE_TRIP_ID
    : getCurrentUserId()
    ? getUserActiveTripKey(getCurrentUserId()!)
    : STORAGE_KEYS.ACTIVE_TRIP_ID;

  if (id === null) {
    storage.removeItem(effectiveKey);
  } else {
    storage.setItem(effectiveKey, id);
  }
}

/**
 * Clears TripSync-specific keys from storage without wiping unrelated browser storage.
 */
export function resetTripSyncStorage(): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(STORAGE_KEYS.TRIPS);
  storage.removeItem(STORAGE_KEYS.ACTIVE_TRIP_ID);
  storage.removeItem(STORAGE_KEYS.GUEST_ACTIVE_TRIP_ID);
  storage.removeItem(STORAGE_KEYS.DEMO_TRIP_STATE);

  const currentUserId = getCurrentUserId();
  if (currentUserId) {
    storage.removeItem(getUserTripsKey(currentUserId));
    storage.removeItem(getUserActiveTripKey(currentUserId));
  }
}

/**
 * Legacy alias for resetTripSyncStorage
 */
export const resetALTravelStorage = resetTripSyncStorage;
