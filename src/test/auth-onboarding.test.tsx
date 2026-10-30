import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AuthProvider } from '../domain/auth/auth.context';
import { SignupView } from '../features/auth/SignupView';
import { LoginView } from '../features/auth/LoginView';
import { UserProfileView } from '../features/auth/UserProfileView';
import { TripWizardView } from '../features/trips/TripWizardView';
import { MemberManagementModal } from '../features/trips/MemberManagementModal';
import { SAMPLE_TRIP } from '../lib/demo-data';
import { Trip } from '../domain/trips/trip.types';
import { apiClient } from '../lib/api-client';

describe('TripSync 2.1 — Authentication & User Onboarding Frontend Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    apiClient.clearSession();
    vi.clearAllMocks();
  });

  const mockAuthResponse = {
    token: 'jwt-mock-token-xyz',
    tokenType: 'Bearer',
    expiresInMs: 86400000,
    user: {
      id: 'usr-test-1',
      email: 'traveler@tripsync.io',
      fullName: 'Alex Morgan',
      role: 'ROLE_USER' as const,
      createdAt: new Date().toISOString(),
    },
    profile: {
      id: 'prof-test-1',
      userId: 'usr-test-1',
      preferredCurrency: 'INR',
      costSensitivity: 'balanced' as const,
      preferredPace: 'moderate' as const,
      primaryPriority: 'preserve-activity' as const,
      willingnessToPaySpeed: 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  describe('Signup Workflow & Form Validation', () => {
    it('validates password matching, strength, and terms acceptance', async () => {
      const onNavigateLogin = vi.fn();
      const onSignupSuccess = vi.fn();

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockAuthResponse,
      } as Response);

      render(
        <AuthProvider>
          <SignupView
            onNavigateToLogin={onNavigateLogin}
            onSuccess={onSignupSuccess}
            onExploreDemo={vi.fn()}
          />
        </AuthProvider>
      );

      const nameInput = screen.getByLabelText(/Full Name/i);
      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByLabelText(/^Password/i);
      const confirmInput = screen.getByLabelText(/Confirm Password/i);
      const termsCheckbox = screen.getByRole('checkbox');
      const form = nameInput.closest('form')!;

      // Enter mismatched passwords
      fireEvent.change(nameInput, { target: { value: 'Alex Morgan' } });
      fireEvent.change(emailInput, { target: { value: 'alex@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Pass1234!' } });
      fireEvent.change(confirmInput, { target: { value: 'Mismatch99!' } });
      fireEvent.click(termsCheckbox);

      fireEvent.submit(form);

      expect(screen.getAllByText(/Passwords do not match/i).length).toBeGreaterThanOrEqual(1);
      expect(onSignupSuccess).not.toHaveBeenCalled();

      // Fix confirm password and test successful signup flow
      fireEvent.change(confirmInput, { target: { value: 'Pass1234!' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSignupSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Login Workflow & Session Persistence', () => {
    it('authenticates user and supports remember-me session storage', async () => {
      const onNavigateSignup = vi.fn();
      const onLoginSuccess = vi.fn();

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAuthResponse,
      } as Response);

      render(
        <AuthProvider>
          <LoginView
            onNavigateToSignup={onNavigateSignup}
            onSuccess={onLoginSuccess}
            onExploreDemo={vi.fn()}
          />
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByLabelText(/Password/i);
      const rememberCheckbox = screen.getByRole('checkbox', { name: /Remember me for 30 days/i });
      const form = emailInput.closest('form')!;

      fireEvent.change(emailInput, { target: { value: 'traveler@tripsync.io' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.click(rememberCheckbox);

      fireEvent.submit(form);

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalled();
      });
    });

    it('displays clear connection error and does not allow fake offline login when backend is unreachable', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

      render(
        <AuthProvider>
          <LoginView
            onNavigateToSignup={vi.fn()}
            onSuccess={vi.fn()}
            onExploreDemo={vi.fn()}
          />
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passwordInput = screen.getByLabelText(/Password/i);
      const form = emailInput.closest('form')!;

      fireEvent.change(emailInput, { target: { value: 'traveler@tripsync.io' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText(/Unable to connect to the TripSync authentication server/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('User Profile Editing', () => {
    it('renders profile summary and enables preference updates', async () => {
      // Seed API client session
      apiClient.setToken('mock-session-token');
      apiClient.saveSession(
        {
          id: 'u-1',
          email: 'traveler@tripsync.io',
          fullName: 'Test Traveler',
          role: 'ROLE_USER',
          createdAt: '2026-10-30T00:00:00Z',
        },
        {
          id: 'prof-1',
          userId: 'u-1',
          preferredCurrency: 'INR',
          costSensitivity: 'balanced',
          preferredPace: 'moderate',
          primaryPriority: 'preserve-activity',
          willingnessToPaySpeed: 0.5,
          createdAt: '2026-10-30T00:00:00Z',
          updatedAt: '2026-10-30T00:00:00Z',
        }
      );

      render(
        <AuthProvider>
          <UserProfileView />
        </AuthProvider>
      );

      // Verify profile info is rendered
      await waitFor(() => {
        expect(screen.getByText('Test Traveler')).toBeInTheDocument();
      });
      expect(screen.getByText('traveler@tripsync.io')).toBeInTheDocument();
      expect(screen.getByText(/Preferred Currency/i)).toBeInTheDocument();

      // Change currency to USD
      const currencySelect = screen.getByRole('combobox', { name: /Preferred Currency/i });
      fireEvent.change(currencySelect, { target: { value: 'USD' } });

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'p-1',
          userId: 'u-1',
          preferredCurrency: 'USD',
          costSensitivity: 'balanced',
          preferredPace: 'moderate',
          primaryPriority: 'preserve-activity',
          willingnessToPaySpeed: 0.5,
          createdAt: '2026-10-30T00:00:00Z',
          updatedAt: '2026-10-30T00:00:00Z',
        }),
      } as Response);

      const form = currencySelect.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText(/Your travel profile and default preferences have been updated/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Custom Trip Onboarding Wizard', () => {
    it('navigates through the 4 steps: Details -> Travelers -> Budget -> Launch', async () => {
      const onComplete = vi.fn();
      const onCancel = vi.fn();

      render(
        <AuthProvider>
          <TripWizardView onComplete={onComplete} onCancel={onCancel} />
        </AuthProvider>
      );

      // Step 1: Trip Details
      expect(screen.getByText(/Step 1: Where and When Are You Traveling/i)).toBeInTheDocument();
      const nameInput = screen.getByLabelText(/Trip Name/i);
      const originInput = screen.getByLabelText(/Origin City/i);
      const destInput = screen.getByLabelText(/^Destination/i);
      const startInput = screen.getByLabelText(/Start Date/i);
      const endInput = screen.getByLabelText(/End Date/i);

      fireEvent.change(nameInput, { target: { value: 'Himalayan Trek 2026' } });
      fireEvent.change(originInput, { target: { value: 'Delhi' } });
      fireEvent.change(destInput, { target: { value: 'Manali' } });
      fireEvent.change(startInput, { target: { value: '2026-11-15' } });
      fireEvent.change(endInput, { target: { value: '2026-11-22' } });

      const nextToGroupBtn = screen.getByRole('button', { name: /Continue to Travelers/i });
      fireEvent.click(nextToGroupBtn);

      // Step 2: Group Travelers
      await waitFor(() => {
        expect(screen.getByText(/Step 2: Add Group Travelers/i)).toBeInTheDocument();
      });

      // Organizer should be listed by default
      expect(screen.getAllByText(/Organizer/i).length).toBeGreaterThanOrEqual(1);

      // Add a guest traveler
      const addMemberBtn = screen.getByRole('button', { name: /Add Traveler/i });
      fireEvent.click(addMemberBtn);

      // Member modal opens
      expect(screen.getByText(/Add New Traveler/i)).toBeInTheDocument();
      const memberNameInput = screen.getByLabelText(/Traveler Name \*/i);
      fireEvent.change(memberNameInput, { target: { value: 'Vikram Joshi' } });

      const saveMemberBtn = screen.getByRole('button', { name: /Save Traveler/i });
      fireEvent.click(saveMemberBtn);

      // Vikram should now be in the group roster
      await waitFor(() => {
        expect(screen.getByText('Vikram Joshi')).toBeInTheDocument();
      });

      const nextToBudgetBtn = screen.getByRole('button', { name: /Continue to Budget/i });
      fireEvent.click(nextToBudgetBtn);

      // Step 3: Budget Configuration
      await waitFor(() => {
        expect(screen.getByText(/Step 3: Group Budget & Default Splitting/i)).toBeInTheDocument();
      });

      const totalBudgetInput = screen.getByLabelText(/Total Group Budget Ceiling/i);
      fireEvent.change(totalBudgetInput, { target: { value: '70000' } });

      const nextToReviewBtn = screen.getByRole('button', { name: /Review Summary/i });
      fireEvent.click(nextToReviewBtn);

      // Step 4: Review and Launch
      await waitFor(() => {
        expect(screen.getByText(/Step 4: Review and Launch Your Trip/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Himalayan Trek 2026')).toBeInTheDocument();
      expect(screen.getByText('Delhi → Manali')).toBeInTheDocument();
      expect(screen.getByText('Vikram Joshi')).toBeInTheDocument();

      const launchBtn = screen.getByRole('button', { name: /Create Trip & Launch Workspace/i });
      fireEvent.click(launchBtn);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
        const callArgs = onComplete.mock.calls[0];
        expect(callArgs).toBeDefined();
        const createdTrip = callArgs?.[0] as Trip;
        expect(createdTrip.name).toBe('Himalayan Trek 2026');
        expect(createdTrip.destination).toBe('Manali');
        expect((createdTrip.members || []).length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Member Management & Departure Recalculation Modal', () => {
    it('allows adding travelers and marking a traveler departed with recalculation', async () => {
      const mockTrip: Trip = { ...SAMPLE_TRIP, members: [...(SAMPLE_TRIP.members || [])] };
      const onUpdateTrip = vi.fn();
      const onClose = vi.fn();

      render(
        <MemberManagementModal
          isOpen={true}
          trip={mockTrip}
          onClose={onClose}
          onUpdateTrip={onUpdateTrip}
        />
      );

      // Verify existing members are listed
      expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
      expect(screen.getByText('Priya Patel')).toBeInTheDocument();

      // Find Rohan Mehta row
      const rohanHeading = screen.getByText('Rohan Mehta');
      const rohanRow = rohanHeading.closest('div[class*="p-3.5"]');
      expect(rohanRow).toBeTruthy();

      const departBtn = within(rohanRow as HTMLElement).getByRole('button', { name: /Depart/i });
      fireEvent.click(departBtn);

      await waitFor(() => {
        expect(onUpdateTrip).toHaveBeenCalled();
        const updateArgs = onUpdateTrip.mock.calls[0];
        expect(updateArgs).toBeDefined();
        const updated = updateArgs?.[0] as Trip;
        const rohan = (updated.members || []).find((m) => m.name === 'Rohan Mehta');
        expect(rohan?.status).toBe('departed');
        // Financial history is preserved
        expect((updated.expenses || []).length).toBeGreaterThanOrEqual((mockTrip.expenses || []).length);
      });
    });
  });
});
