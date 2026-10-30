import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { AuthProvider } from '../domain/auth/auth.context';
import { apiClient } from '../lib/api-client';
import { STORAGE_KEYS, getUserTripsKey } from '../lib/storage';
import { Trip } from '../domain/trips/trip.types';

// Mock Himalayan Ski Trip from legacy unauthenticated session
const MOCK_HIMALAYAN_TRIP: Trip = {
  id: 'trip-himalayan-1',
  name: 'Himalayan Ski Trip',
  origin: 'Delhi (DEL)',
  destination: 'Gulmarg (SXR)',
  startDate: '2026-12-15',
  endDate: '2026-12-22',
  totalBudget: 80000,
  members: [
    {
      id: 'mem-user-1',
      tripId: 'trip-himalayan-1',
      name: 'Unauth Traveler',
      email: 'traveler@legacy.io',
      role: 'organizer',
      status: 'active',
      personalBudget: 80000,
      preferences: {
        activityInterests: ['skiing'],
        costSensitivity: 'balanced',
        preferredPace: 'moderate',
        priority: 'preserve-activity',
        willingnessToPayExtraForSpeed: 0.5,
      },
    },
  ],
  bookings: [
    {
      id: 'book-ski-resort',
      tripId: 'trip-himalayan-1',
      type: 'hotel',
      provider: 'Khyber Himalayan Resort & Spa',
      location: 'Gulmarg, Kashmir',
      startTime: '2026-12-15T14:00:00Z',
      endTime: '2026-12-22T11:00:00Z',
      status: 'confirmed',
      confirmationReference: 'KHY-88912',
      cost: 45000,
      currency: 'INR',
      paidByMemberId: 'mem-user-1',
      participantMemberIds: ['mem-user-1'],
    },
  ],
  isSample: false,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

// Mock Authenticated User (Alice)
const ALICE_USER = {
  id: 'usr-alice-777',
  email: 'alice@tripsync.io',
  fullName: 'Alice Walker',
  role: 'ROLE_USER' as const,
  createdAt: '2026-10-25T00:00:00Z',
};

const ALICE_PROFILE = {
  id: 'prof-alice-777',
  userId: 'usr-alice-777',
  preferredCurrency: 'INR',
  costSensitivity: 'balanced' as const,
  preferredPace: 'moderate' as const,
  primaryPriority: 'preserve-budget' as const,
  willingnessToPaySpeed: 0.5,
  createdAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
};

// Alice's personal trip
const ALICE_PARIS_TRIP: Trip = {
  id: 'trip-alice-paris-99',
  userId: 'usr-alice-777',
  name: 'Alice Paris Gateway',
  origin: 'Mumbai (BOM)',
  destination: 'Paris (CDG)',
  startDate: '2027-04-10',
  endDate: '2027-04-18',
  totalBudget: 120000,
  members: [
    {
      id: 'mem-alice',
      tripId: 'trip-alice-paris-99',
      name: 'Alice Walker',
      email: 'alice@tripsync.io',
      role: 'organizer',
      status: 'active',
      personalBudget: 120000,
      preferences: {
        activityInterests: ['sightseeing'],
        costSensitivity: 'balanced',
        preferredPace: 'moderate',
        priority: 'minimize-cost',
        willingnessToPayExtraForSpeed: 0.5,
      },
    },
  ],
  bookings: [
    {
      id: 'book-paris-flight',
      tripId: 'trip-alice-paris-99',
      type: 'flight',
      provider: 'Air France AF-217',
      location: 'BOM → CDG',
      startTime: '2027-04-10T02:00:00Z',
      endTime: '2027-04-10T09:00:00Z',
      status: 'confirmed',
      cost: 42000,
      currency: 'INR',
      paidByMemberId: 'mem-alice',
      participantMemberIds: ['mem-alice'],
    },
    {
      id: 'book-paris-hotel',
      tripId: 'trip-alice-paris-99',
      type: 'hotel',
      provider: 'Le Marais Boutique Hotel',
      location: '4th Arrondissement, Paris',
      startTime: '2027-04-10T14:00:00Z',
      endTime: '2027-04-18T11:00:00Z',
      status: 'confirmed',
      cost: 20000,
      currency: 'INR',
      paidByMemberId: 'mem-alice',
      participantMemberIds: ['mem-alice'],
    },
  ],
  isSample: false,
  createdAt: '2026-10-25T00:00:00Z',
  updatedAt: '2026-10-25T00:00:00Z',
};

// Another user's trip (Bob)
const BOB_SECRET_TRIP: Trip = {
  id: 'trip-bob-secret-44',
  userId: 'usr-bob-888',
  name: 'Bob Secret Expedition',
  origin: 'Bengaluru (BLR)',
  destination: 'Ladakh (IXL)',
  startDate: '2027-06-01',
  endDate: '2027-06-10',
  totalBudget: 50000,
  members: [],
  bookings: [],
  isSample: false,
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-20T00:00:00Z',
};

describe('CRITICAL: Guest Data Isolation & Authentication Boundaries', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    apiClient.clearSession();
    vi.restoreAllMocks();
  });

  // Scenario A: Fresh browser, no login
  describe('Scenario A: Fresh browser, no login', () => {
    it('shows zero personal trips, no Himalayan Ski Trip, and clean guest dashboard', () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      // Verify dashboard shows 0 personal trips and clean guest mode
      expect(screen.getByText('Guest (Unauthenticated)')).toBeInTheDocument();
      expect(screen.getByText(/welcome to tripsync guest mode/i)).toBeInTheDocument();
      expect(screen.queryByText('Himalayan Ski Trip')).not.toBeInTheDocument();
      expect(screen.queryByText('Goa Coastal Getaway')).not.toBeInTheDocument();
    });

    it('makes Goa demo accessible when explicitly requested without requiring registration', async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      // Click "Load Sample Trip (4-Member Goa Demo)"
      const loadSampleBtns = screen.getAllByRole('button', { name: /load sample trip/i });
      fireEvent.click(loadSampleBtns[0]!);

      // Goa demo appears and is clearly labeled as simulated
      await waitFor(() => {
        expect(screen.getByText(/Goa Coastal Getaway/i)).toBeInTheDocument();
      });

      expect(screen.getAllByText(/simulated demo/i).length).toBeGreaterThanOrEqual(1);
      // Clean guest mode preserved
      expect(screen.getByText('Guest (Unauthenticated)')).toBeInTheDocument();
    });
  });

  // Scenario B: Existing browser with old localStorage data, no login
  describe('Scenario B: Existing browser with old localStorage data, no login', () => {
    it('does NOT expose old personal trips or Himalayan Ski Trip to guest visitor', () => {
      // Simulate existing browser that previously stored trips in legacy global key
      localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([MOCK_HIMALAYAN_TRIP]));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TRIP_ID, MOCK_HIMALAYAN_TRIP.id);

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      // Must NOT display Himalayan Ski Trip
      expect(screen.queryByText('Himalayan Ski Trip')).not.toBeInTheDocument();
      expect(screen.queryByText('Khyber Himalayan Resort & Spa')).not.toBeInTheDocument();

      // Metrics must be zeroed for unauthenticated visitor
      expect(screen.getByText('Guest (Unauthenticated)')).toBeInTheDocument();
      expect(screen.getByText('Monitored Bookings')).toBeInTheDocument();
      expect(screen.getByText('₹0')).toBeInTheDocument();

      // Clean empty state shown
      expect(screen.getByText(/welcome to tripsync guest mode/i)).toBeInTheDocument();

      // Legacy storage was preserved safely (not blindly destroyed)
      const legacyRaw = localStorage.getItem(STORAGE_KEYS.TRIPS);
      expect(legacyRaw).toContain('Himalayan Ski Trip');
    });
  });

  // Scenario C: Authenticated user
  describe('Scenario C: Authenticated user', () => {
    it('displays only their own personal trips and financial data, never another user trips', async () => {
      // Save Alice's trip to Alice's scoped storage
      localStorage.setItem(getUserTripsKey(ALICE_USER.id), JSON.stringify([ALICE_PARIS_TRIP]));
      // Save Bob's trip to Bob's scoped storage
      localStorage.setItem(getUserTripsKey(BOB_SECRET_TRIP.userId!), JSON.stringify([BOB_SECRET_TRIP]));

      // Log in Alice
      apiClient.setToken('mock-alice-jwt');
      apiClient.saveSession(ALICE_USER, ALICE_PROFILE);

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      // Alice's trip is visible
      await waitFor(() => {
        expect(screen.getByText('Alice Paris Gateway')).toBeInTheDocument();
      });

      // Bob's trip is NOT visible
      expect(screen.queryByText('Bob Secret Expedition')).not.toBeInTheDocument();

      // Alice's session and financial metrics are visible
      expect(screen.getByText(`Account (${ALICE_USER.email})`)).toBeInTheDocument();
      expect(screen.getByText('Monitored Bookings')).toBeInTheDocument();
      expect(screen.getAllByText('₹62,000').length).toBeGreaterThanOrEqual(1); // ₹42k + ₹20k
    });
  });

  // Scenario D: Logout
  describe('Scenario D: Logout', () => {
    it('clears personal trips immediately and returns guest dashboard to clean state', async () => {
      // Setup authenticated Alice session
      localStorage.setItem(getUserTripsKey(ALICE_USER.id), JSON.stringify([ALICE_PARIS_TRIP]));
      apiClient.setToken('mock-alice-jwt');
      apiClient.saveSession(ALICE_USER, ALICE_PROFILE);

      // Mock backend logout endpoint
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out successfully' }),
      } as Response);

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      // Alice is authenticated and sees her trip
      await waitFor(() => {
        expect(screen.getByText('Alice Paris Gateway')).toBeInTheDocument();
      });

      // Open profile menu
      const profileButton = screen.getByText('Alice Walker').closest('button');
      expect(profileButton).toBeDefined();
      fireEvent.click(profileButton!);

      // Click "Log Out"
      const logoutBtn = screen.getByRole('button', { name: /log out/i });
      fireEvent.click(logoutBtn);

      // Personal trips disappear immediately
      await waitFor(() => {
        expect(screen.queryByText('Alice Paris Gateway')).not.toBeInTheDocument();
      });

      // Clean guest dashboard is restored
      expect(screen.getByText('Guest (Unauthenticated)')).toBeInTheDocument();
      expect(screen.getByText(/welcome to tripsync guest mode/i)).toBeInTheDocument();
      expect(screen.getByText('₹0')).toBeInTheDocument();

      // Alice's stored data remains preserved in her user key for future login
      const aliceData = localStorage.getItem(getUserTripsKey(ALICE_USER.id));
      expect(aliceData).toContain('Alice Paris Gateway');
    });
  });

  // Scenario E: Reload & Storage Isolation
  describe('Scenario E: Reload & Storage Isolation', () => {
    it('preserves user storage isolation across browser reloads', async () => {
      // 1. Initial guest visit: clean state
      const { unmount } = render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
      expect(screen.getByText('Guest (Unauthenticated)')).toBeInTheDocument();
      unmount();

      // 2. Alice logs in
      localStorage.setItem(getUserTripsKey(ALICE_USER.id), JSON.stringify([ALICE_PARIS_TRIP]));
      apiClient.setToken('mock-alice-jwt');
      apiClient.saveSession(ALICE_USER, ALICE_PROFILE);

      const { unmount: unmountAuth } = render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
      await waitFor(() => {
        expect(screen.getByText('Alice Paris Gateway')).toBeInTheDocument();
      });
      unmountAuth();

      // 3. Browser session cleared (e.g. guest opens in new tab without token)
      apiClient.clearSession();

      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );

      // Guest cannot see Alice's data even though Alice's data is still in localStorage
      expect(screen.queryByText('Alice Paris Gateway')).not.toBeInTheDocument();
      expect(screen.getByText('Guest (Unauthenticated)')).toBeInTheDocument();
      expect(screen.getByText(/welcome to tripsync guest mode/i)).toBeInTheDocument();
    });
  });
});
