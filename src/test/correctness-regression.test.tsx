import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RecoveryPlannerView } from '../features/recovery/RecoveryPlannerView';
import { CreateBookingModal } from '../features/trips/CreateBookingModal';
import { SAMPLE_TRIP } from '../lib/demo-data';
import { Trip } from '../domain/trips/trip.types';
import { Booking } from '../domain/bookings/booking.types';

const CUSTOM_TRIP: Trip = {
  id: 'trip-custom-1',
  name: 'Custom Himalayas Trek',
  origin: 'Delhi (DEL)',
  destination: 'Leh (IXL)',
  startDate: '2026-12-01',
  endDate: '2026-12-07',
  isSample: false,
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
  bookings: [
    {
      id: 'custom-flight-1',
      tripId: 'trip-custom-1',
      type: 'flight',
      provider: 'SpiceJet SG-123',
      location: 'DEL → IXL',
      startTime: '2026-12-01T06:00:00+05:30',
      endTime: '2026-12-01T07:30:00+05:30',
      cost: 5000,
      currency: 'INR',
      status: 'confirmed',
    },
    {
      id: 'custom-hotel-1',
      tripId: 'trip-custom-1',
      type: 'hotel',
      provider: 'Grand Dragon Ladakh',
      location: 'Old Road, Leh',
      startTime: '2026-12-01T12:00:00+05:30',
      endTime: '2026-12-07T10:00:00+05:30',
      cost: 25000,
      currency: 'INR',
      status: 'confirmed',
    },
  ],
};

const EMPTY_TRIP: Trip = {
  id: 'trip-empty-1',
  name: 'Blank New Itinerary',
  origin: 'Mumbai (BOM)',
  destination: 'Jaipur (JAI)',
  startDate: '2026-12-10',
  endDate: '2026-12-15',
  isSample: false,
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
  bookings: [],
};

describe('Focused Correctness Regressions', () => {
  it('1. Switching from demo trip to custom trip does not retain demo recovery options', () => {
    const { rerender } = render(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP, CUSTOM_TRIP]}
        activeTrip={SAMPLE_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    // On demo trip, sample options exist
    expect(screen.getAllByText(/Air India Express IX-412/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Vande Bharat Express/i).length).toBeGreaterThan(0);

    // Re-render with custom trip
    rerender(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP, CUSTOM_TRIP]}
        activeTrip={CUSTOM_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    // Stale demo options must be completely gone
    expect(screen.queryByText(/Air India Express IX-412/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vande Bharat Express/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/No candidate recovery options defined yet/i)
    ).toBeInTheDocument();
  });

  it('2. Switching trips selects a valid booking or clears selection if no bookings exist', () => {
    const { rerender } = render(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP, CUSTOM_TRIP, EMPTY_TRIP]}
        activeTrip={SAMPLE_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    const legSelect = screen.getByLabelText(/Disrupted Leg/i) as HTMLSelectElement;
    expect(legSelect.value).toBe('demo-booking-flight-1');

    // Switch to custom trip
    rerender(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP, CUSTOM_TRIP, EMPTY_TRIP]}
        activeTrip={CUSTOM_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    const updatedSelect = screen.getByLabelText(/Disrupted Leg/i) as HTMLSelectElement;
    // Must select the custom trip's first booking and NOT demo-booking-flight-1
    expect(updatedSelect.value).toBe('custom-flight-1');
    expect(updatedSelect.value).not.toBe('demo-booking-flight-1');

    // Switch to empty trip
    rerender(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP, CUSTOM_TRIP, EMPTY_TRIP]}
        activeTrip={EMPTY_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    // Empty itinerary state is displayed, Disrupted Leg select is guarded and not rendered
    expect(screen.getByTestId('empty-itinerary-state')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Disrupted Leg/i)).not.toBeInTheDocument();
  });

  it('3. Critical-booking selections never refer to IDs outside the active trip', () => {
    const { rerender } = render(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP, CUSTOM_TRIP]}
        activeTrip={SAMPLE_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    // Demo trip lists scuba diving in critical commitments
    expect(
      screen.getAllByText(/Grande Island Scuba Adventures/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('checkbox', { name: /Grande Island Scuba Adventures/i })
    ).toBeInTheDocument();

    // Switch to custom trip
    rerender(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP, CUSTOM_TRIP]}
        activeTrip={CUSTOM_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    // Scuba diving from demo trip must not appear anywhere on custom trip
    expect(screen.queryByText(/Grande Island Scuba Adventures/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Grande Island Scuba Adventures/i })
    ).not.toBeInTheDocument();

    // Only custom hotel critical commitment checkbox should be listed
    expect(
      screen.getByRole('checkbox', { name: /Grand Dragon Ladakh/i })
    ).toBeInTheDocument();
  });

  it('4. Switching selected recovery plans does not carry completed checkboxes to unrelated actions', () => {
    render(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP]}
        activeTrip={SAMPLE_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    // Step 5 action plan checklist is rendered for default Plan A (Alternative flight + cab)
    const actionPlanCard = screen.getByTestId('action-plan-checklist');
    const planACheckboxes = within(actionPlanCard).getAllByTestId('action-checkbox');
    expect(planACheckboxes[0]).not.toBeChecked();

    // Check step 1 on Plan A
    fireEvent.click(planACheckboxes[0]!);
    expect(planACheckboxes[0]).toBeChecked();

    // Find "Select Plan & View Action List" buttons
    const selectPlanBtns = screen.getAllByRole('button', {
      name: /Select Plan & View Action List/i,
    });
    expect(selectPlanBtns.length).toBeGreaterThan(0);

    // Switch to Plan B (Budget Train)
    fireEvent.click(selectPlanBtns[0]!);

    // In Plan B, Step 1 must NOT be completed!
    const planBCheckboxes = within(screen.getByTestId('action-plan-checklist')).getAllByTestId('action-checkbox');
    expect(planBCheckboxes[0]).not.toBeChecked();

    // Switch back to Plan A: Step 1 should still be checked!
    const selectPlanABtns = screen.getAllByRole('button', {
      name: /Select Plan & View Action List/i,
    });
    fireEvent.click(selectPlanABtns[0]!);
    const restoredPlanACheckboxes = within(screen.getByTestId('action-plan-checklist')).getAllByTestId('action-checkbox');
    expect(restoredPlanACheckboxes[0]).toBeChecked();
  });

  it('5. Changing priority or regenerating plans does not mark unrelated actions complete', () => {
    render(
      <RecoveryPlannerView
        trips={[SAMPLE_TRIP]}
        activeTrip={SAMPLE_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
      />
    );

    // Initially on preserve-activity with Plan A (Alternative flight + cab)
    const actionPlanCard = screen.getByTestId('action-plan-checklist');
    const initialActions = within(actionPlanCard).getAllByTestId('action-checkbox');
    fireEvent.click(initialActions[0]!);
    expect(initialActions[0]).toBeChecked();

    // Uncheck scuba diving as a non-negotiable critical commitment so Budget Train is feasible
    const scubaCriticalCheckbox = screen.getByRole('checkbox', {
      name: /Grande Island Scuba Adventures/i,
    });
    fireEvent.click(scubaCriticalCheckbox);

    // Switch priority to Minimize Extra Spending
    const minSpendingBtn = screen.getByRole('button', { name: /Minimize Extra Spending/i });
    fireEvent.click(minSpendingBtn);

    // Top active plan is now Budget Train (which has different actions)
    const reorderedActions = within(screen.getByTestId('action-plan-checklist')).getAllByTestId('action-checkbox');
    expect(reorderedActions[0]).not.toBeChecked();

    // Switch back to Preserve Important Activity: Plan A is restored as top active plan, and its Action 1 is still checked
    const preserveActivityBtn = screen.getByRole('button', { name: /Preserve Important Activity/i });
    fireEvent.click(preserveActivityBtn);
    const restoredActions = within(screen.getByTestId('action-plan-checklist')).getAllByTestId('action-checkbox');
    expect(restoredActions[0]).toBeChecked();
  });

  it('6. Creating a booking with an omitted optional start time succeeds when permitted by the domain model', () => {
    const handleCreated = vi.fn();
    const handleClose = vi.fn();

    const { rerender } = render(
      <CreateBookingModal
        isOpen={true}
        tripId="trip-custom-1"
        onClose={handleClose}
        onBookingCreated={handleCreated}
      />
    );

    // 1. Fill hotel booking with blank start time
    const typeSelect = screen.getByLabelText(/Booking Type/i);
    fireEvent.change(typeSelect, { target: { value: 'hotel' } });

    fireEvent.change(screen.getByLabelText(/Provider \/ Name/i), {
      target: { value: 'Sea Breeze Resort' },
    });
    fireEvent.change(screen.getByLabelText(/Location \/ Route/i), {
      target: { value: 'Calangute, Goa' },
    });
    fireEvent.change(screen.getByLabelText(/Cost/i), {
      target: { value: '3500' },
    });

    // Leave Start Time / Departure / Check-In completely blank!
    const startTimeInput = screen.getByLabelText(/Start Time \/ Check-In \(Optional\)/i);
    fireEvent.change(startTimeInput, { target: { value: '' } });

    // Submit form
    const form = screen.getByRole('button', { name: /Save Booking/i }).closest('form')!;
    fireEvent.submit(form);

    // Must successfully invoke onBookingCreated with startTime undefined
    expect(handleCreated).toHaveBeenCalledTimes(1);
    const firstCall = handleCreated.mock.calls[0];
    expect(firstCall).toBeDefined();
    const createdBooking = firstCall![0] as Booking;
    expect(createdBooking.type).toBe('hotel');
    expect(createdBooking.provider).toBe('Sea Breeze Resort');
    expect(createdBooking.startTime).toBeUndefined();

    // 2. Flight booking with empty start time must be rejected
    handleCreated.mockClear();
    rerender(
      <CreateBookingModal
        isOpen={true}
        tripId="trip-custom-1"
        onClose={handleClose}
        onBookingCreated={handleCreated}
      />
    );

    fireEvent.change(screen.getByLabelText(/Booking Type/i), { target: { value: 'flight' } });
    fireEvent.change(screen.getByLabelText(/Provider \/ Name/i), {
      target: { value: 'IndiGo 6E-101' },
    });
    fireEvent.change(screen.getByLabelText(/Location \/ Route/i), {
      target: { value: 'DEL → IXL' },
    });
    fireEvent.change(screen.getByLabelText(/Cost/i), {
      target: { value: '4000' },
    });
    fireEvent.change(screen.getByLabelText(/Departure Time \(Required\)/i), {
      target: { value: '' },
    });

    const flightForm = screen.getByRole('button', { name: /Save Booking/i }).closest('form')!;
    fireEvent.submit(flightForm);

    // Must NOT call onBookingCreated, and must display validation error
    expect(handleCreated).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Start time is required and must be a valid date\/time string/i)
    ).toBeInTheDocument();
  });

  it('7. An empty itinerary renders the intended guidance and recovers correctly after adding a booking', () => {
    const goToBookings = vi.fn();

    const { rerender } = render(
      <RecoveryPlannerView
        trips={[EMPTY_TRIP]}
        activeTrip={EMPTY_TRIP}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
        onGoToBookings={goToBookings}
      />
    );

    // Empty itinerary card is rendered
    expect(screen.getByTestId('empty-itinerary-state')).toBeInTheDocument();
    expect(
      screen.getByText(/Empty Itinerary — No Bookings Available/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/At least one transport, lodging, or activity booking must be added/i)
    ).toBeInTheDocument();

    // Call-to-action button calls onGoToBookings
    const addBtn = screen.getByRole('button', { name: /Add Bookings to Itinerary/i });
    fireEvent.click(addBtn);
    expect(goToBookings).toHaveBeenCalledTimes(1);

    // Now simulate user having added a booking to the empty trip
    const populatedTrip: Trip = {
      ...EMPTY_TRIP,
      bookings: [
        {
          id: 'b-new-1',
          tripId: EMPTY_TRIP.id,
          type: 'flight',
          provider: 'Akasa Air QP-11',
          location: 'BOM → JAI',
          startTime: '2026-12-10T09:00:00+05:30',
          cost: 3200,
          currency: 'INR',
          status: 'confirmed',
        },
      ],
    };

    rerender(
      <RecoveryPlannerView
        trips={[populatedTrip]}
        activeTrip={populatedTrip}
        onSelectTrip={() => {}}
        onLoadSample={() => {}}
        onGoToBookings={goToBookings}
      />
    );

    // Empty state disappears and the full planner appears with the new booking selected
    expect(screen.queryByTestId('empty-itinerary-state')).not.toBeInTheDocument();
    const select = screen.getByLabelText(/Disrupted Leg/i) as HTMLSelectElement;
    expect(select.value).toBe('b-new-1');
  });
});
