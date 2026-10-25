import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import * as storage from '../lib/storage';

import { SAMPLE_TRIP } from '../lib/demo-data';

describe('App Persistence Failure Handling', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('displays an error alert and does not display success when trip creation persistence fails', async () => {
    vi.spyOn(storage, 'upsertTrip').mockReturnValue(false);

    render(<App />);

    // Click "Create New Trip"
    const newTripBtn = screen.getByRole('button', { name: /create new trip/i });
    fireEvent.click(newTripBtn);

    // Fill form
    fireEvent.change(screen.getByLabelText(/trip name/i), { target: { value: 'Test Fail Trip' } });
    fireEvent.change(screen.getByLabelText(/origin/i), { target: { value: 'HYD' } });
    fireEvent.change(screen.getByLabelText(/destination/i), { target: { value: 'GOA' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-11-12' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /^create trip$/i });
    fireEvent.click(submitBtn);

    // Verify error notification is displayed
    await waitFor(() => {
      expect(screen.getByText(/storage write unsuccessful/i)).toBeInTheDocument();
    });

    // Success notification must NOT be displayed
    expect(screen.queryByText(/created successfully/i)).not.toBeInTheDocument();
  });

  it('displays an error alert when trip deletion fails', async () => {
    storage.loadSampleTrip();
    vi.spyOn(storage, 'deleteTrip').mockReturnValue(false);

    render(<App />);

    // Click Delete Trip
    const deleteBtn = await screen.findByTitle('Delete Trip');
    fireEvent.click(deleteBtn);

    // Error notification must be shown
    await waitFor(() => {
      expect(screen.getByText(/failed to delete trip/i)).toBeInTheDocument();
    });

    // Success notification must not be shown
    expect(screen.queryByText(/removed from storage/i)).not.toBeInTheDocument();
  });

  it('displays an error alert and does not display success when loading sample trip fails even if old sample exists', async () => {
    // 1. Initial sample trip already exists in storage
    storage.loadSampleTrip();

    // 2. Mock loadSampleTrip to fail on reload
    vi.spyOn(storage, 'loadSampleTrip').mockReturnValue({
      success: false,
      trip: SAMPLE_TRIP,
    });

    render(<App />);

    // Click "Load Sample Trip (Hyderabad → Goa)"
    const loadSampleBtns = screen.getAllByRole('button', { name: /load sample trip/i });
    const targetBtn = loadSampleBtns[0];
    expect(targetBtn).toBeDefined();
    if (targetBtn) {
      fireEvent.click(targetBtn);
    }

    // Error notification must be displayed
    await waitFor(() => {
      expect(screen.getByText(/failed to persist sample trip to localstorage/i)).toBeInTheDocument();
    });

    // Success notification must not be displayed
    expect(screen.queryByText(/loaded into localstorage/i)).not.toBeInTheDocument();
  });
});
