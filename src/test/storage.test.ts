import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTrips,
  saveTrips,
  upsertTrip,
  deleteTrip,
  resetALTravelStorage,
  loadSampleTrip,
  getActiveTripId,
  setActiveTripId,
  STORAGE_KEYS,
} from '../lib/storage';
import { Trip } from '../domain/trips/trip.types';
import { DEMO_TRIP_ID } from '../lib/demo-data';

describe('Storage Layer (localStorage persistence)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const sampleTrip1: Trip = {
    id: 'test-trip-1',
    name: 'Mumbai Client Meeting',
    origin: 'Hyderabad',
    destination: 'Mumbai',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    bookings: [],
    createdAt: '2026-10-25T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  };

  it('returns empty array when storage is empty', () => {
    expect(loadTrips()).toEqual([]);
  });

  it('persists and retrieves valid trips', () => {
    saveTrips([sampleTrip1]);
    const loaded = loadTrips();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe('Mumbai Client Meeting');
  });

  it('upserts new trip correctly', () => {
    upsertTrip(sampleTrip1);
    const loaded = loadTrips();
    expect(loaded).toHaveLength(1);

    const updated: Trip = {
      ...sampleTrip1,
      name: 'Mumbai Client Meeting (Updated)',
    };
    upsertTrip(updated);
    const reloaded = loadTrips();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]?.name).toBe('Mumbai Client Meeting (Updated)');
  });

  it('deletes trip by id and updates active trip id', () => {
    upsertTrip(sampleTrip1);
    setActiveTripId('test-trip-1');
    expect(getActiveTripId()).toBe('test-trip-1');

    deleteTrip('test-trip-1');
    expect(loadTrips()).toHaveLength(0);
    expect(getActiveTripId()).toBeNull();
  });

  it('gracefully handles completely corrupted JSON in localStorage', () => {
    window.localStorage.setItem(STORAGE_KEYS.TRIPS, '{ corrupt json !!!');
    const loaded = loadTrips();
    expect(loaded).toEqual([]);
  });

  it('filters out malformed items while retaining valid ones', () => {
    const rawList = [
      sampleTrip1,
      { id: 'broken-item', missingFields: true },
    ];
    window.localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(rawList));
    const loaded = loadTrips();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('test-trip-1');
  });

  it('loads sample trip correctly into storage', () => {
    const trip = loadSampleTrip();
    expect(trip.id).toBe(DEMO_TRIP_ID);
    expect(trip.bookings).toHaveLength(3);
    expect(trip.isSample).toBe(true);

    const storedTrips = loadTrips();
    expect(storedTrips.some((t) => t.id === DEMO_TRIP_ID)).toBe(true);
    expect(getActiveTripId()).toBe(DEMO_TRIP_ID);
  });

  it('resets only ALTravel storage keys without wiping unrelated storage keys', () => {
    window.localStorage.setItem('unrelated_user_pref', 'dark_theme');
    loadSampleTrip();

    resetALTravelStorage();
    expect(loadTrips()).toHaveLength(0);
    expect(getActiveTripId()).toBeNull();
    // Unrelated storage must remain intact
    expect(window.localStorage.getItem('unrelated_user_pref')).toBe('dark_theme');
  });

  describe('Storage failure handling', () => {
    it('returns false from upsertTrip when validation fails', () => {
      const invalidTrip = { ...sampleTrip1, name: '' };
      const success = upsertTrip(invalidTrip as Trip);
      expect(success).toBe(false);
    });

    it('returns false from upsertTrip when localStorage.setItem throws', () => {
      const originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      const success = upsertTrip(sampleTrip1);
      expect(success).toBe(false);

      window.localStorage.setItem = originalSetItem;
    });

    it('returns false from deleteTrip when localStorage.setItem throws', () => {
      upsertTrip(sampleTrip1);

      const originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = () => {
        throw new Error('StorageDisabledError');
      };

      const success = deleteTrip('test-trip-1');
      expect(success).toBe(false);

      window.localStorage.setItem = originalSetItem;
    });

    it('returns false from saveTrips when localStorage.setItem throws', () => {
      const originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };

      const success = saveTrips([sampleTrip1]);
      expect(success).toBe(false);

      window.localStorage.setItem = originalSetItem;
    });
  });
});
