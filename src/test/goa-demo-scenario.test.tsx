import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';
import * as storage from '../lib/storage';
import { computeTripLedger } from '../domain/expenses/splitting.engine';
import { recalculateBookingCancellation, recalculateBookingPriceChange, recalculateMemberDeparture } from '../domain/recalculation/recalculation.engine';
import { generateTripAlerts } from '../domain/alerts/alert.engine';

describe('TripSync - Live Goa Demo Scenario End-to-End Validation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('executes the full 9-step Goa demonstration scenario accurately with exact math verification', async () => {
    // 1. Load the application
    render(<App />);

    // Click "Load Sample Trip (4-Member Goa Demo)"
    const loadSampleBtns = screen.getAllByRole('button', { name: /load sample trip/i });
    fireEvent.click(loadSampleBtns[0]!);

    // Verify trip is loaded and active
    await waitFor(() => {
      expect(screen.getByText(/Goa Coastal Getaway/i)).toBeInTheDocument();
    });

    // 2. Click "View Trip Details" on the trip card to open the detail view and inspect the 4 members
    const viewDetailsBtn = screen.getByRole('button', { name: /view trip details/i });
    fireEvent.click(viewDetailsBtn);

    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText('Rohan Mehta')).toBeInTheDocument();
    expect(screen.getAllByText('Ananya Iyer').length).toBeGreaterThanOrEqual(1);

    // Verify initial mathematical state
    const initialTrips = storage.loadTrips();
    const activeTrip = initialTrips[0]!;
    expect(activeTrip.members).toHaveLength(4);

    const initialLedger = computeTripLedger(activeTrip);
    expect(initialLedger.totalGroupBudget).toBe(67500);
    // 4850 (flight) + 36000 (hotel) + 4200 (scuba) + 4800 (dinner) + 1600 (cab) = 51450
    expect(initialLedger.totalGroupCommittedSpend).toBe(51450);
    expect(initialLedger.remainingGroupBudget).toBe(16050);

    // Initial Member Net Balances
    const aaravInitial = initialLedger.memberSummaries.find(m => m.memberId === 'mem-aarav')!;
    const priyaInitial = initialLedger.memberSummaries.find(m => m.memberId === 'mem-priya')!;
    const rohanInitial = initialLedger.memberSummaries.find(m => m.memberId === 'mem-rohan')!;
    const ananyaInitial = initialLedger.memberSummaries.find(m => m.memberId === 'mem-ananya')!;

    expect(aaravInitial.totalOwed).toBe(13912.5);
    expect(aaravInitial.totalPaid).toBe(9050);
    expect(aaravInitial.netBalance).toBe(-4862.5);

    expect(priyaInitial.totalOwed).toBe(11812.5);
    expect(priyaInitial.totalPaid).toBe(4800);
    expect(priyaInitial.netBalance).toBe(-7012.5);

    expect(rohanInitial.totalOwed).toBe(11812.5);
    expect(rohanInitial.totalPaid).toBe(1600);
    expect(rohanInitial.netBalance).toBe(-10212.5);

    expect(ananyaInitial.totalOwed).toBe(13912.5);
    expect(ananyaInitial.totalPaid).toBe(36000);
    expect(ananyaInitial.netBalance).toBe(22087.5);

    // 3. Open Group Consensus and compare the itinerary options
    const consensusTabBtn = screen.getAllByRole('button', { name: /consensus engine/i })[0]!;
    fireEvent.click(consensusTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Candidate Itinerary Alternatives & Consensus Ranking/i)).toBeInTheDocument();
    });

    // Verify consensus ranking cards exist
    expect(screen.getByText(/Consensus Winner/i)).toBeInTheDocument();
    expect(screen.getByText(/Group Preference Profiles \(4 Members\)/i)).toBeInTheDocument();

    // 4. Open Group Ledger and add ₹2,400 paragliding expense paid by Rohan, shared between Aarav & Rohan
    const ledgerTabBtn = screen.getAllByRole('button', { name: /group ledger/i })[0]!;
    fireEvent.click(ledgerTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Group Financial Ledger/i)).toBeInTheDocument();
    });

    const addExpenseBtn = screen.getByRole('button', { name: /add shared expense/i });
    fireEvent.click(addExpenseBtn);

    const modal = screen.getByRole('dialog');

    // Fill form
    fireEvent.change(screen.getByLabelText(/expense description/i), { target: { value: 'Paragliding Activity' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '2400' } });
    fireEvent.change(screen.getByLabelText(/paid by/i), { target: { value: 'mem-rohan' } });

    // Ensure Priya and Ananya are deselected in modal
    const priyaToggle = within(modal).getByText('Priya Patel').closest('button')!;
    const ananyaToggle = within(modal).getByText('Ananya Iyer').closest('button')!;
    fireEvent.click(priyaToggle);
    fireEvent.click(ananyaToggle);

    // Submit modal
    const saveExpenseBtn = within(modal).getByRole('button', { name: /save & rebalance ledger/i });
    fireEvent.click(saveExpenseBtn);

    // 5. Verify the updated individual balances
    await waitFor(() => {
      expect(screen.getByText('Paragliding Activity')).toBeInTheDocument();
    });

    const postExpenseTrips = storage.loadTrips();
    const tripWithExpense = postExpenseTrips[0]!;
    const postExpenseLedger = computeTripLedger(tripWithExpense);

    // Total spend increased by 2,400 -> 53,850
    expect(postExpenseLedger.totalGroupCommittedSpend).toBe(53850);

    const aaravPostExp = postExpenseLedger.memberSummaries.find(m => m.memberId === 'mem-aarav')!;
    const rohanPostExp = postExpenseLedger.memberSummaries.find(m => m.memberId === 'mem-rohan')!;

    // Aarav absorbs +1,200: net balance becomes -4,862.50 - 1,200 = -6,062.50
    expect(aaravPostExp.totalOwed).toBe(15112.5);
    expect(aaravPostExp.netBalance).toBe(-6062.5);

    // Rohan paid +2,400, owes +1,200: net balance shifts by +1,200 from -10,212.50 to -9,012.50
    expect(rohanPostExp.totalPaid).toBe(4000);
    expect(rohanPostExp.totalOwed).toBe(13012.5);
    expect(rohanPostExp.netBalance).toBe(-9012.5);

    // Rohan personal budget was 12,500, now owes 13,012.50 -> budget exceeded by 512.50!
    expect(rohanPostExp.remainingBudget).toBe(-512.5);
    expect(rohanPostExp.budgetStatus).toBe('exceeded');

    // 6. Cancel Scuba booking (demo-booking-scuba-1, ₹4,200)
    const { updatedTrip: tripAfterCancel, snapshot: cancelSnapshot } = recalculateBookingCancellation(
      tripWithExpense,
      'demo-booking-scuba-1',
      '2026-11-01T10:00:00Z'
    );

    expect(cancelSnapshot.eventType).toBe('booking_cancellation');
    expect(cancelSnapshot.totalRefundGenerated).toBe(4200);

    const aaravCancelDelta = cancelSnapshot.memberDeltas.find(d => d.memberId === 'mem-aarav')!;
    const ananyaCancelDelta = cancelSnapshot.memberDeltas.find(d => d.memberId === 'mem-ananya')!;
    const priyaCancelDelta = cancelSnapshot.memberDeltas.find(d => d.memberId === 'mem-priya')!;
    const rohanCancelDelta = cancelSnapshot.memberDeltas.find(d => d.memberId === 'mem-rohan')!;

    // Aarav and Ananya each receive 2,100 refund credit
    expect(aaravCancelDelta.refundCredit).toBe(2100);
    expect(aaravCancelDelta.deltaAmount).toBe(-2100);
    expect(ananyaCancelDelta.refundCredit).toBe(2100);
    expect(ananyaCancelDelta.deltaAmount).toBe(-2100);

    // Priya and Rohan did not participate -> 0 delta
    expect(priyaCancelDelta.deltaAmount).toBe(0);
    expect(priyaCancelDelta.refundCredit).toBe(0);
    expect(rohanCancelDelta.deltaAmount).toBe(0);
    expect(rohanCancelDelta.refundCredit).toBe(0);

    // 7. Increase resort cost from ₹36,000 to ₹44,000 (+₹8,000)
    const { updatedTrip: tripAfterPriceChange, snapshot: priceSnapshot } = recalculateBookingPriceChange(
      tripAfterCancel,
      'demo-booking-hotel-1',
      44000
    );

    expect(priceSnapshot.eventType).toBe('booking_price_change');
    // +8,000 split across 4 members = +2,000 each
    priceSnapshot.memberDeltas.forEach(delta => {
      expect(delta.deltaAmount).toBe(2000);
    });

    // 8. Member Departure: Ananya Iyer departs trip with group_absorbs_shared policy
    const { updatedTrip: tripAfterDeparture, snapshot: departureSnapshot } = recalculateMemberDeparture(
      tripAfterPriceChange,
      {
        departingMemberId: 'mem-ananya',
        reason: 'Family emergency departure',
        policy: 'group_absorbs_shared',
      }
    );

    expect(departureSnapshot.eventType).toBe('member_departure');
    const ananyaDepartureDelta = departureSnapshot.memberDeltas.find(d => d.memberId === 'mem-ananya')!;
    expect(ananyaDepartureDelta.deltaAmount).toBeLessThan(0); // released from liability

    const remainingActiveDeltas = departureSnapshot.memberDeltas.filter(d => d.memberId !== 'mem-ananya');
    remainingActiveDeltas.forEach(delta => {
      expect(delta.deltaAmount).toBeGreaterThan(0); // absorb Ananya's share
    });

    // 9. Alerts Center: Verify alerts correspond to all changes
    const allAlerts = generateTripAlerts(tripAfterDeparture);
    expect(allAlerts.length).toBeGreaterThan(0);

    // Must have a member departure alert for Ananya
    expect(allAlerts.some(a => a.type === 'member_change' && a.title.includes('Ananya'))).toBe(true);

    // Must have a booking cancellation alert for Scuba
    expect(allAlerts.some(a => a.type === 'booking_disruption' && a.title.includes('Scuba'))).toBe(true);

    // Must have a personal budget alert for Rohan
    expect(allAlerts.some(a => a.type === 'personal_budget_exceeded' && a.targetMemberId === 'mem-rohan')).toBe(true);

    // Must have pending settlement alerts
    expect(allAlerts.some(a => a.type === 'settlement_due')).toBe(true);
  });
});
