import { describe, it, expect } from 'vitest';
import {
  recalculateBookingCancellation,
  recalculateBookingPriceChange,
  recalculateMemberDeparture,
} from '../domain/recalculation/recalculation.engine';
import { SAMPLE_TRIP } from '../lib/demo-data';

describe('TripSync - Change-Aware Financial Recalculation Engine (USP)', () => {
  describe('Booking Cancellation Recalculation', () => {
    it('calculates refund credits for participants when a refundable booking is cancelled', () => {
      // demo-booking-scuba-1 is 4,200 INR refundable activity participated by Aarav and Ananya
      const { updatedTrip, snapshot } = recalculateBookingCancellation(
        SAMPLE_TRIP,
        'demo-booking-scuba-1',
        '2026-11-01T10:00:00Z' // well before activity start
      );

      expect(snapshot.eventType).toBe('booking_cancellation');
      expect(snapshot.triggerEntityId).toBe('demo-booking-scuba-1');
      expect(snapshot.memberDeltas).toHaveLength(4);

      // Verify that booking status is marked cancelled in updated trip
      const cancelledBooking = updatedTrip.bookings.find((b) => b.id === 'demo-booking-scuba-1');
      expect(cancelledBooking?.status).toBe('cancelled');

      // Aarav and Ananya were the participants (2,100 INR each)
      const aaravDelta = snapshot.memberDeltas.find((d) => d.memberId === 'mem-aarav');
      const ananyaDelta = snapshot.memberDeltas.find((d) => d.memberId === 'mem-ananya');
      const priyaDelta = snapshot.memberDeltas.find((d) => d.memberId === 'mem-priya');
      const rohanDelta = snapshot.memberDeltas.find((d) => d.memberId === 'mem-rohan');

      expect(aaravDelta?.refundCredit).toBe(2100);
      expect(aaravDelta?.deltaAmount).toBe(-2100);
      expect(ananyaDelta?.refundCredit).toBe(2100);
      expect(ananyaDelta?.deltaAmount).toBe(-2100);

      // Priya and Rohan were not participants -> 0 delta, 0 refund
      expect(priyaDelta?.deltaAmount).toBe(0);
      expect(priyaDelta?.refundCredit).toBe(0);
      expect(priyaDelta?.explanation).toContain('Not participating');
      expect(rohanDelta?.deltaAmount).toBe(0);
      expect(rohanDelta?.refundCredit).toBe(0);

      // Total refund generated should equal booking cost
      expect(snapshot.totalRefundGenerated).toBe(4200);
      expect(snapshot.totalUnrecoverableLoss).toBe(0);
    });

    it('throws error when booking ID is not found', () => {
      expect(() => {
        recalculateBookingCancellation(SAMPLE_TRIP, 'non-existent-booking-id');
      }).toThrow(/not found/i);
    });
  });

  describe('Booking Price Change Recalculation', () => {
    it('redistributes cost increase equally among confirmed participants and checks personal budgets', () => {
      // demo-booking-hotel-1 (Taj Exotica Resort) original cost: 36,000 INR shared by all 4 members (9,000 INR each)
      // Increase price to 44,000 INR (+8,000 INR total, +2,000 INR each)
      const { updatedTrip, snapshot } = recalculateBookingPriceChange(
        SAMPLE_TRIP,
        'demo-booking-hotel-1',
        44000
      );

      expect(snapshot.eventType).toBe('booking_price_change');
      expect(snapshot.triggerEntityId).toBe('demo-booking-hotel-1');
      expect(snapshot.summary).toContain('36000 to 44000');

      const updatedHotel = updatedTrip.bookings.find((b) => b.id === 'demo-booking-hotel-1');
      expect(updatedHotel?.cost).toBe(44000);

      // All 4 members participated, so each member's liability increases by 2,000 INR
      snapshot.memberDeltas.forEach((delta) => {
        expect(delta.deltaAmount).toBe(2000);
        expect(delta.updatedLiability).toBe(delta.priorLiability + 2000);
        expect(delta.explanation).toContain('Price increased');
      });
    });

    it('redistributes cost savings when price is reduced', () => {
      // Reduce flight cost from 4850 to 2850 INR (-2,000 INR total, -500 INR each)
      const { snapshot } = recalculateBookingPriceChange(
        SAMPLE_TRIP,
        'demo-booking-flight-1',
        2850
      );

      expect(snapshot.totalRefundGenerated).toBe(2000);
      snapshot.memberDeltas.forEach((delta) => {
        expect(delta.deltaAmount).toBe(-500);
        expect(delta.refundCredit).toBe(500);
        expect(delta.explanation).toContain('savings');
      });
    });
  });

  describe('Member Departure Recalculation', () => {
    it('rebalances shared liabilities across remaining active members when a member departs', () => {
      // Member Ananya (mem-ananya) departs the trip with policy group_absorbs_shared
      const { updatedTrip, snapshot } = recalculateMemberDeparture(SAMPLE_TRIP, {
        departingMemberId: 'mem-ananya',
        reason: 'Family event conflict',
        policy: 'group_absorbs_shared',
      });

      expect(snapshot.eventType).toBe('member_departure');
      expect(snapshot.triggerEntityId).toBe('mem-ananya');

      // Verify Ananya status updated to departed
      const departedMember = updatedTrip.members?.find((m) => m.id === 'mem-ananya');
      expect(departedMember?.status).toBe('departed');
      expect(departedMember?.departureReason).toBe('Family event conflict');

      // Ananya's liability for shared bookings is released
      const ananyaDelta = snapshot.memberDeltas.find((d) => d.memberId === 'mem-ananya');
      expect(ananyaDelta).toBeDefined();
      expect(ananyaDelta!.deltaAmount).toBeLessThan(0);
      expect(ananyaDelta!.explanation).toContain('Released from remaining active shared obligations');

      // Remaining active members (Aarav, Priya, Rohan) absorb Ananya's share of shared bookings
      const remainingDeltas = snapshot.memberDeltas.filter((d) => d.memberId !== 'mem-ananya');
      remainingDeltas.forEach((delta) => {
        expect(delta.deltaAmount).toBeGreaterThan(0);
        expect(delta.explanation).toContain("absorb Ananya Iyer's departure");
      });
    });

    it('throws error when departing member is not found', () => {
      expect(() => {
        recalculateMemberDeparture(SAMPLE_TRIP, {
          departingMemberId: 'ghost-member',
          policy: 'group_absorbs_shared',
        });
      }).toThrow(/not found/i);
    });
  });
});
