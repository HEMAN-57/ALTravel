import { describe, it, expect } from 'vitest';
import { Trip } from '../domain/trips/trip.types';
import { Booking } from '../domain/bookings/booking.types';
import { BookingDependency } from '../domain/disruptions/dependency.types';
import { propagateDisruption } from '../domain/disruptions/propagation.engine';

describe('Milestone 2: Disruption Propagation Engine', () => {
  // Base test itinerary with two trains, a hotel, and an independent activity
  const train1: Booking = {
    id: 'train-1',
    tripId: 'test-trip-1',
    type: 'train',
    provider: 'Vande Bharat Express 201',
    location: 'HYD -> PUNE',
    startTime: '2026-11-20T06:00:00Z',
    endTime: '2026-11-20T10:00:00Z', // Arrives 10:00 UTC
    cost: 1500,
    currency: 'INR',
    status: 'confirmed',
  };

  const train2: Booking = {
    id: 'train-2',
    tripId: 'test-trip-1',
    type: 'train',
    provider: 'Deccan Queen 102',
    location: 'PUNE -> BOM',
    startTime: '2026-11-20T12:00:00Z', // Departs 12:00 UTC (2h original buffer)
    endTime: '2026-11-20T15:15:00Z',
    cost: 950,
    currency: 'INR',
    status: 'confirmed',
  };

  const hotelBooking: Booking = {
    id: 'hotel-1',
    tripId: 'test-trip-1',
    type: 'hotel',
    provider: 'The Taj Mahal Palace, Mumbai',
    location: 'Colaba, Mumbai',
    startTime: '2026-11-20T16:00:00Z',
    endTime: '2026-11-22T11:00:00Z',
    cost: 25000,
    currency: 'INR',
    status: 'confirmed',
  };

  const unrelatedActivity: Booking = {
    id: 'activity-unrelated',
    tripId: 'test-trip-1',
    type: 'activity',
    provider: 'Elephanta Caves Guided Tour',
    location: 'Gateway of India, Mumbai',
    startTime: '2026-11-21T09:00:00Z',
    endTime: '2026-11-21T13:00:00Z',
    cost: 1800,
    currency: 'INR',
    status: 'confirmed',
  };

  const connectionDependency: BookingDependency = {
    id: 'dep-train1-train2',
    upstreamBookingId: 'train-1',
    downstreamBookingId: 'train-2',
    relationshipType: 'transit-connection',
    requiredBufferMinutes: 45, // 45 minutes transfer buffer required
    commitmentType: 'hard',
    description: 'Platform transfer at Pune Junction',
  };

  const lodgingDependency: BookingDependency = {
    id: 'dep-train2-hotel',
    upstreamBookingId: 'train-2',
    downstreamBookingId: 'hotel-1',
    relationshipType: 'arrival-to-lodging',
    commitmentType: 'flexible',
    description: 'Transit to hotel check-in',
  };

  const baseTrip: Trip = {
    id: 'test-trip-1',
    name: 'Western Railway Journey',
    origin: 'Hyderabad',
    destination: 'Mumbai',
    startDate: '2026-11-20',
    endDate: '2026-11-22',
    bookings: [train1, train2, hotelBooking, unrelatedActivity],
    dependencies: [connectionDependency, lodgingDependency],
    createdAt: '2026-10-25T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  };

  // --------------------------------------------------------------------------
  // Scenario A: Connection survives
  // --------------------------------------------------------------------------
  it('Scenario A: Connection survives when delay leaves sufficient transfer buffer', () => {
    // Train 1 arriving at 10:00 is delayed by 60 min -> arrives 11:00
    // Train 2 departs at 12:00 -> leaves 60 min available transfer
    // 60 min available >= 45 min required buffer -> connection survives!
    const result = propagateDisruption(baseTrip, {
      type: 'delay',
      targetBookingId: 'train-1',
      delayMinutes: 60,
    });

    expect(result.success).toBe(true);
    expect(result.disruptedBookingId).toBe('train-1');

    const train2Impact = result.impacts.find((i) => i.bookingId === 'train-2');
    expect(train2Impact).toBeDefined();
    expect(train2Impact?.status).toBe('unaffected');
    expect(train2Impact?.explanation).toContain('satisfies the required 45-minute buffer');
    expect(train2Impact?.evidence?.availableTransferMinutes).toBe(60);
    expect(train2Impact?.evidence?.requiredBufferMinutes).toBe(45);
  });

  // --------------------------------------------------------------------------
  // Scenario B: Connection missed
  // --------------------------------------------------------------------------
  it('Scenario B: Connection is marked affected when delay consumes required transfer buffer', () => {
    // Train 1 delayed by 100 min -> arrives 11:40
    // Train 2 departs at 12:00 -> leaves 20 min available transfer
    // 20 min available < 45 min required buffer -> connection missed (affected)!
    const result = propagateDisruption(baseTrip, {
      type: 'delay',
      targetBookingId: 'train-1',
      delayMinutes: 100,
    });

    expect(result.success).toBe(true);

    const train2Impact = result.impacts.find((i) => i.bookingId === 'train-2');
    expect(train2Impact).toBeDefined();
    expect(train2Impact?.status).toBe('affected');
    expect(train2Impact?.cause).toContain('Transfer buffer violated');
    expect(train2Impact?.evidence?.availableTransferMinutes).toBe(20);
    expect(train2Impact?.evidence?.bufferDeficitMinutes).toBe(25);
  });

  // --------------------------------------------------------------------------
  // Scenario C: Cancellation
  // --------------------------------------------------------------------------
  it('Scenario C: Upstream cancellation marks downstream connection as affected', () => {
    // Train 1 is cancelled
    // Train 2 explicitly depends on Train 1 -> cannot be boarded via scheduled route
    const result = propagateDisruption(baseTrip, {
      type: 'cancellation',
      targetBookingId: 'train-1',
    });

    expect(result.success).toBe(true);
    expect(result.disruptionType).toBe('cancellation');

    const train1Impact = result.impacts.find((i) => i.bookingId === 'train-1');
    expect(train1Impact?.status).toBe('affected');

    const train2Impact = result.impacts.find((i) => i.bookingId === 'train-2');
    expect(train2Impact?.status).toBe('affected');
    expect(train2Impact?.cause).toContain('cancelled');
    expect(train2Impact?.explanation).toContain('preceding travel leg');
  });

  // --------------------------------------------------------------------------
  // Scenario D: Unrelated booking
  // --------------------------------------------------------------------------
  it('Scenario D: Unrelated booking with no dependency path is NOT marked affected', () => {
    const result = propagateDisruption(baseTrip, {
      type: 'cancellation',
      targetBookingId: 'train-1',
    });

    expect(result.success).toBe(true);

    // unrelatedActivity has no incoming dependency from train-1 or train-2
    const activityImpact = result.impacts.find((i) => i.bookingId === 'activity-unrelated');
    expect(activityImpact).toBeDefined();
    expect(activityImpact?.status).toBe('unaffected');
    expect(activityImpact?.cause).toContain('No dependency path');
    expect(result.summary.totalAffected).not.toBeGreaterThan(2);
  });

  // --------------------------------------------------------------------------
  // Scenario E: Hotel uncertainty
  // --------------------------------------------------------------------------
  it('Scenario E: Hotel following disrupted journey is not marked lost or cancelled without explicit cutoff', () => {
    // When train-1 is cancelled or delayed, hotel check-in has flexible commitment
    const result = propagateDisruption(baseTrip, {
      type: 'cancellation',
      targetBookingId: 'train-1',
    });

    expect(result.success).toBe(true);

    const hotelImpact = result.impacts.find((i) => i.bookingId === 'hotel-1');
    expect(hotelImpact).toBeDefined();
    // Must NOT be marked affected (lost/cancelled)
    expect(hotelImpact?.status).not.toBe('affected');
    expect(hotelImpact?.status).toBe('atRisk');
    expect(hotelImpact?.explanation).toContain('not automatically lost or non-refundable');
  });

  it('Scenario E (variant): Delayed arrival within flexible window keeps hotel unaffected', () => {
    const result = propagateDisruption(baseTrip, {
      type: 'delay',
      targetBookingId: 'train-1',
      delayMinutes: 60,
    });

    const hotelImpact = result.impacts.find((i) => i.bookingId === 'hotel-1');
    expect(hotelImpact?.status).toBe('unaffected');
    expect(hotelImpact?.explanation).toContain('flexible');
  });

  // --------------------------------------------------------------------------
  // Scenario F: Invalid dependency graph
  // --------------------------------------------------------------------------
  describe('Scenario F: Graph Validation and Cycle Detection', () => {
    it('rejects dependency referencing a nonexistent booking', () => {
      const invalidDep: BookingDependency = {
        id: 'dep-ghost',
        upstreamBookingId: 'train-1',
        downstreamBookingId: 'nonexistent-flight-id',
        relationshipType: 'transit-connection',
        commitmentType: 'hard',
      };

      const result = propagateDisruption(
        baseTrip,
        { type: 'delay', targetBookingId: 'train-1', delayMinutes: 30 },
        [invalidDep]
      );

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('nonexistent downstream booking ID'))).toBe(true);
    });

    it('rejects self-dependency', () => {
      const selfDep: BookingDependency = {
        id: 'dep-self',
        upstreamBookingId: 'train-1',
        downstreamBookingId: 'train-1',
        relationshipType: 'transit-connection',
        commitmentType: 'hard',
      };

      const result = propagateDisruption(
        baseTrip,
        { type: 'delay', targetBookingId: 'train-1', delayMinutes: 30 },
        [selfDep]
      );

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('self-dependency'))).toBe(true);
    });

    it('detects and rejects cyclic dependencies (A -> B -> A)', () => {
      const cyclicDeps: BookingDependency[] = [
        {
          id: 'dep-cycle-1',
          upstreamBookingId: 'train-1',
          downstreamBookingId: 'train-2',
          relationshipType: 'transit-connection',
          commitmentType: 'hard',
        },
        {
          id: 'dep-cycle-2',
          upstreamBookingId: 'train-2',
          downstreamBookingId: 'train-1', // Cycles back!
          relationshipType: 'transit-connection',
          commitmentType: 'hard',
        },
      ];

      const result = propagateDisruption(
        baseTrip,
        { type: 'delay', targetBookingId: 'train-1', delayMinutes: 30 },
        cyclicDeps
      );

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('Dependency cycle detected'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Additional Edge Cases & Timing Validations
  // --------------------------------------------------------------------------
  describe('Input and Timing Edge Cases', () => {
    it('rejects negative delay duration', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: -15,
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('non-negative number of minutes'))).toBe(true);
    });

    it('handles zero-minute delay without disrupting connections', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 0,
      });

      expect(result.success).toBe(true);
      const targetImpact = result.impacts.find((i) => i.bookingId === 'train-1');
      expect(targetImpact?.status).toBe('unaffected');

      const train2Impact = result.impacts.find((i) => i.bookingId === 'train-2');
      expect(train2Impact?.status).toBe('unaffected');
    });

    it('rejects target booking not in trip', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'cancellation',
        targetBookingId: 'unknown-booking-xyz',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('does not exist in trip'))).toBe(true);
    });

    it('rejects invalid revised arrival date string', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
        revisedArrivalTime: 'not-a-valid-date',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('valid ISO date/time string'))).toBe(true);
    });

    it('returns unknown status when downstream start time is missing', () => {
      const missingTimingBooking: Booking = {
        id: 'no-time-train',
        tripId: 'test-trip-1',
        type: 'train',
        provider: 'Mystery Rail',
        location: 'Nowhere',
        startTime: '', // Missing
        cost: 100,
        currency: 'INR',
        status: 'confirmed',
      };

      const customTrip: Trip = {
        ...baseTrip,
        bookings: [train1, missingTimingBooking],
        dependencies: [
          {
            id: 'dep-missing',
            upstreamBookingId: 'train-1',
            downstreamBookingId: 'no-time-train',
            relationshipType: 'transit-connection',
            requiredBufferMinutes: 30,
            commitmentType: 'hard',
          },
        ],
      };

      const result = propagateDisruption(customTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
      });

      expect(result.success).toBe(true);
      const missingImpact = result.impacts.find((i) => i.bookingId === 'no-time-train');
      expect(missingImpact?.status).toBe('unknown');
      expect(missingImpact?.explanation).toContain('missing or unknown');
    });

    it('does not mutate original Trip or Booking objects', () => {
      const tripClone = JSON.parse(JSON.stringify(baseTrip));

      propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 120,
      });

      expect(baseTrip).toEqual(tripClone);
    });
  });
});
