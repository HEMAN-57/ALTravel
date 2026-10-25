import { describe, it, expect } from 'vitest';
import { Trip } from '../domain/trips/trip.types';
import { Booking } from '../domain/bookings/booking.types';
import { BookingDependency, BookingCommitmentType } from '../domain/disruptions/dependency.types';
import { validateDependencies } from '../domain/disruptions/dependency.validation';
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

  // ============================================================================
  // Milestone 2.1: Disruption Engine Correctness Hardening
  // ============================================================================

  describe('Milestone 2.1: 1. Correct Multi-Leg Timing Propagation (A -> B -> C)', () => {
    const legA: Booking = {
      id: 'leg-a',
      tripId: 'multi-leg-trip',
      type: 'train',
      provider: 'Express A',
      location: 'City 1 -> City 2',
      startTime: '2026-11-20T08:00:00Z',
      endTime: '2026-11-20T10:00:00Z',
      cost: 1000,
      currency: 'INR',
      status: 'confirmed',
    };

    const legB: Booking = {
      id: 'leg-b',
      tripId: 'multi-leg-trip',
      type: 'flight',
      provider: 'Connecting Flight B',
      location: 'City 2 -> City 3',
      startTime: '2026-11-20T12:00:00Z',
      endTime: '2026-11-20T14:00:00Z',
      cost: 4000,
      currency: 'INR',
      status: 'confirmed',
    };

    const legC: Booking = {
      id: 'leg-c',
      tripId: 'multi-leg-trip',
      type: 'train',
      provider: 'Onward Train C',
      location: 'City 3 -> City 4',
      startTime: '2026-11-20T16:00:00Z',
      endTime: '2026-11-20T18:00:00Z',
      cost: 800,
      currency: 'INR',
      status: 'confirmed',
    };

    const hotelC: Booking = {
      id: 'hotel-c',
      tripId: 'multi-leg-trip',
      type: 'hotel',
      provider: 'Grand Hotel City 3',
      location: 'City 3',
      startTime: '2026-11-20T15:00:00Z',
      cost: 5000,
      currency: 'INR',
      status: 'confirmed',
    };

    const depAB: BookingDependency = {
      id: 'dep-a-b',
      upstreamBookingId: 'leg-a',
      downstreamBookingId: 'leg-b',
      relationshipType: 'transit-connection',
      requiredBufferMinutes: 60,
      commitmentType: 'hard',
    };

    const depBC: BookingDependency = {
      id: 'dep-b-c',
      upstreamBookingId: 'leg-b',
      downstreamBookingId: 'leg-c',
      relationshipType: 'transit-connection',
      requiredBufferMinutes: 60,
      commitmentType: 'hard',
    };

    const depBHotel: BookingDependency = {
      id: 'dep-b-hotel',
      upstreamBookingId: 'leg-b',
      downstreamBookingId: 'hotel-c',
      relationshipType: 'arrival-to-lodging',
      commitmentType: 'flexible',
    };

    const multiLegTrip: Trip = {
      id: 'multi-leg-trip',
      name: 'Multi-Leg Propagation Verification',
      origin: 'City 1',
      destination: 'City 4',
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      bookings: [legA, legB, legC, hotelC, unrelatedActivity],
      dependencies: [depAB, depBC, depBHotel],
      createdAt: '2026-10-25T10:00:00Z',
      updatedAt: '2026-10-25T10:00:00Z',
    };

    it('Scenario 1.1: Delay A but preserve A -> B; verifies B scheduled timing remains intact and B -> C is evaluated on-time', () => {
      // Delay legA by 30 mins (arrives 10:30 UTC instead of 10:00 UTC)
      // Available transfer to legB (departs 12:00 UTC) = 90 mins >= 60 mins required -> connection survives!
      const result = propagateDisruption(multiLegTrip, {
        type: 'delay',
        targetBookingId: 'leg-a',
        delayMinutes: 30,
      });

      expect(result.success).toBe(true);

      const impactA = result.impacts.find((i) => i.bookingId === 'leg-a');
      expect(impactA?.status).toBe('affected');
      expect(impactA?.scheduleChanged).toBe(true);
      expect(impactA?.revisedStartTime).toBe('2026-11-20T08:30:00.000Z');
      expect(impactA?.revisedEndTime).toBe('2026-11-20T10:30:00.000Z');

      const impactB = result.impacts.find((i) => i.bookingId === 'leg-b');
      expect(impactB?.status).toBe('unaffected');
      expect(impactB?.cause).toContain('Transfer window is sufficient');
      // B's scheduled timing must remain intact without being shifted
      expect(impactB?.scheduleChanged).toBe(false);
      expect(impactB?.originalStartTime).toBe('2026-11-20T12:00:00Z');
      expect(impactB?.originalEndTime).toBe('2026-11-20T14:00:00Z');
      expect(impactB?.revisedStartTime).toBe('2026-11-20T12:00:00Z');
      expect(impactB?.revisedEndTime).toBe('2026-11-20T14:00:00Z');

      // B -> C connection evaluates against B's scheduled arrival (14:00 UTC)
      // legC departs 16:00 UTC -> 120 mins buffer >= 60 mins -> C is unaffected
      const impactC = result.impacts.find((i) => i.bookingId === 'leg-c');
      expect(impactC?.status).toBe('unaffected');
      expect(impactC?.scheduleChanged).toBe(false);
      expect(impactC?.revisedStartTime).toBe('2026-11-20T16:00:00Z');
      expect(impactC?.revisedEndTime).toBe('2026-11-20T18:00:00Z');
    });

    it('Scenario 1.2: Miss A -> B connection; downstream C is NOT calculated using an unchanged, fictional connection', () => {
      // Delay legA by 90 mins (arrives 11:30 UTC)
      // Available transfer to legB (departs 12:00 UTC) = 30 mins < 60 mins required -> connection missed!
      const result = propagateDisruption(multiLegTrip, {
        type: 'delay',
        targetBookingId: 'leg-a',
        delayMinutes: 90,
      });

      expect(result.success).toBe(true);

      const impactB = result.impacts.find((i) => i.bookingId === 'leg-b');
      expect(impactB?.status).toBe('affected');
      expect(impactB?.cause).toContain('Transfer buffer violated');
      expect(impactB?.revisedStartTime).toBeUndefined();
      expect(impactB?.revisedEndTime).toBeUndefined();
      expect(impactB?.scheduleChanged).toBe(true);

      // Downstream legC must NOT be assessed as on-time based on a fictional B arrival!
      const impactC = result.impacts.find((i) => i.bookingId === 'leg-c');
      expect(impactC?.status).toBe('affected');
      expect(impactC?.cause).toContain('Preceding connection was missed');
      expect(impactC?.explanation).toContain('preceding travel connection "Connecting Flight B" was missed');
      expect(impactC?.revisedStartTime).toBeUndefined();
      expect(impactC?.revisedEndTime).toBeUndefined();

      // Hotel C receives uncertainty-aware atRisk status (not fictional unaffected)
      const impactHotel = result.impacts.find((i) => i.bookingId === 'hotel-c');
      expect(impactHotel?.status).toBe('atRisk');
      expect(impactHotel?.cause).toContain('Preceding connection was missed');
      expect(impactHotel?.explanation).toContain('not automatically lost or non-refundable');
    });

    it('Scenario 1.3: Cancel A; downstream effects cascade across explicit graph according to uncertainty rules', () => {
      const result = propagateDisruption(multiLegTrip, {
        type: 'cancellation',
        targetBookingId: 'leg-a',
      });

      expect(result.success).toBe(true);

      const impactA = result.impacts.find((i) => i.bookingId === 'leg-a');
      expect(impactA?.status).toBe('affected');

      const impactB = result.impacts.find((i) => i.bookingId === 'leg-b');
      expect(impactB?.status).toBe('affected');
      expect(impactB?.cause).toContain('Upstream connection "Express A" was cancelled');

      const impactC = result.impacts.find((i) => i.bookingId === 'leg-c');
      expect(impactC?.status).toBe('affected');

      const impactHotel = result.impacts.find((i) => i.bookingId === 'hotel-c');
      expect(impactHotel?.status).toBe('atRisk');

      const impactUnrelated = result.impacts.find((i) => i.bookingId === 'activity-unrelated');
      expect(impactUnrelated?.status).toBe('unaffected');
      expect(impactUnrelated?.cause).toContain('No dependency path');
    });
  });

  describe('Milestone 2.1: 2. Honest Incomplete Timing Handling', () => {
    it('returns unknown status when upstream arrival time is unknown (missing endTime)', () => {
      const noArrivalTrain: Booking = {
        id: 'no-end-train',
        tripId: 'incomplete-trip',
        type: 'train',
        provider: 'Open Arrival Rail',
        location: 'City A -> City B',
        startTime: '2026-11-20T08:00:00Z',
        cost: 500,
        currency: 'INR',
        status: 'confirmed',
      };

      const downstreamTrain: Booking = {
        id: 'downstream-train',
        tripId: 'incomplete-trip',
        type: 'train',
        provider: 'Connecting Express',
        location: 'City B -> City C',
        startTime: '2026-11-20T12:00:00Z',
        endTime: '2026-11-20T14:00:00Z',
        cost: 800,
        currency: 'INR',
        status: 'confirmed',
      };

      const trip: Trip = {
        id: 'incomplete-trip',
        name: 'Incomplete Timing Test',
        origin: 'City A',
        destination: 'City C',
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        bookings: [noArrivalTrain, downstreamTrain],
        dependencies: [
          {
            id: 'dep-incomplete',
            upstreamBookingId: 'no-end-train',
            downstreamBookingId: 'downstream-train',
            relationshipType: 'transit-connection',
            requiredBufferMinutes: 45,
            commitmentType: 'hard',
          },
        ],
        createdAt: '2026-10-25T10:00:00Z',
        updatedAt: '2026-10-25T10:00:00Z',
      };

      const result = propagateDisruption(trip, {
        type: 'delay',
        targetBookingId: 'no-end-train',
        delayMinutes: 30,
      });

      expect(result.success).toBe(true);
      const downstreamImpact = result.impacts.find((i) => i.bookingId === 'downstream-train');
      expect(downstreamImpact?.status).toBe('unknown');
      expect(downstreamImpact?.cause).toContain('Incomplete upstream schedule');
      expect(downstreamImpact?.evidence?.missingInformation).toContain('upstream arrival time');
    });

    it('returns unknown status when downstream departure time is genuinely unknown (undefined startTime)', () => {
      const unscheduledTour: Booking = {
        id: 'unscheduled-tour',
        tripId: 'incomplete-trip-2',
        type: 'activity',
        provider: 'Open Hours Museum Entry',
        location: 'City Museum',
        cost: 300,
        currency: 'INR',
        status: 'confirmed',
      };

      const trip: Trip = {
        ...baseTrip,
        bookings: [train1, unscheduledTour],
        dependencies: [
          {
            id: 'dep-tour',
            upstreamBookingId: 'train-1',
            downstreamBookingId: 'unscheduled-tour',
            relationshipType: 'arrival-to-activity',
            requiredBufferMinutes: 30,
            commitmentType: 'flexible',
          },
        ],
      };

      const result = propagateDisruption(trip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
      });

      expect(result.success).toBe(true);
      const tourImpact = result.impacts.find((i) => i.bookingId === 'unscheduled-tour');
      expect(tourImpact?.status).toBe('unknown');
      expect(tourImpact?.cause).toContain('Incomplete downstream schedule');
      expect(tourImpact?.evidence?.missingInformation).toContain('downstream start time');
    });

    it('returns atRisk status when transfer buffer is unspecified and arrival precedes departure', () => {
      const tripWithoutBuffer: Trip = {
        ...baseTrip,
        dependencies: [
          {
            id: 'dep-no-buffer',
            upstreamBookingId: 'train-1',
            downstreamBookingId: 'train-2',
            relationshipType: 'transit-connection',
            commitmentType: 'hard',
          },
        ],
      };

      const result = propagateDisruption(tripWithoutBuffer, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
      });

      expect(result.success).toBe(true);
      const train2Impact = result.impacts.find((i) => i.bookingId === 'train-2');
      expect(train2Impact?.status).toBe('atRisk');
      expect(train2Impact?.cause).toContain('Unspecified transfer buffer');
    });

    it('returns affected status when transfer buffer is unspecified but arrival is after departure', () => {
      const tripWithoutBuffer: Trip = {
        ...baseTrip,
        dependencies: [
          {
            id: 'dep-no-buffer',
            upstreamBookingId: 'train-1',
            downstreamBookingId: 'train-2',
            relationshipType: 'transit-connection',
            commitmentType: 'hard',
          },
        ],
      };

      // train-1 delayed by 180 mins arrives at 13:00 UTC; train-2 departs at 12:00 UTC
      const result = propagateDisruption(tripWithoutBuffer, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 180,
      });

      expect(result.success).toBe(true);
      const train2Impact = result.impacts.find((i) => i.bookingId === 'train-2');
      expect(train2Impact?.status).toBe('affected');
      expect(train2Impact?.cause).toContain('Arrival occurs after departure');
    });

    it('rejects unparseable invalid date strings in trip bookings as validation errors', () => {
      const badBookingTrip: Trip = {
        ...baseTrip,
        bookings: [
          {
            ...train1,
            startTime: 'completely-invalid-date-format',
          },
        ],
      };

      const result = propagateDisruption(badBookingTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('has invalid startTime'))).toBe(true);
    });

    it('rejects invalid endTime and arrivalDeadline as validation errors', () => {
      const badEndTimeTrip: Trip = {
        ...baseTrip,
        bookings: [
          {
            ...train1,
            endTime: 'malformed-end-time',
          },
        ],
      };

      const result = propagateDisruption(badEndTimeTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('has invalid endTime'))).toBe(true);
    });
  });

  describe('Milestone 2.1: 3. Uncertainty-Aware Hotel Outcomes', () => {
    it('marks hotel affected when confirmed strict arrival cutoff is exceeded', () => {
      const hotelWithStrictCutoff: Booking = {
        ...hotelBooking,
        arrivalDeadline: '2026-11-20T16:00:00Z', // 16:00 UTC strict cutoff
      };

      const trip: Trip = {
        ...baseTrip,
        bookings: [train1, train2, hotelWithStrictCutoff],
      };

      // Delay train-2 by 60 mins so it arrives at 16:15 UTC (exceeding 16:00 UTC cutoff)
      const result = propagateDisruption(trip, {
        type: 'delay',
        targetBookingId: 'train-2',
        delayMinutes: 60,
      });

      expect(result.success).toBe(true);
      const hotelImpact = result.impacts.find((i) => i.bookingId === 'hotel-1');
      expect(hotelImpact?.status).toBe('affected');
      expect(hotelImpact?.cause).toContain('Exceeded hotel late check-in cutoff deadline');
      expect(hotelImpact?.explanation).toContain('exceeds the hotel\'s confirmed check-in cutoff');
    });

    it('marks hotel confirmed safe (unaffected) when arrival precedes confirmed cutoff deadline', () => {
      const hotelWithConfirmedCutoff: Booking = {
        ...hotelBooking,
        arrivalDeadline: '2026-11-20T20:00:00Z', // 20:00 UTC confirmed cutoff
      };

      const trip: Trip = {
        ...baseTrip,
        bookings: [train1, train2, hotelWithConfirmedCutoff],
      };

      // Delay train-2 by 60 mins -> arrives 16:15 UTC (well within 20:00 UTC cutoff)
      const result = propagateDisruption(trip, {
        type: 'delay',
        targetBookingId: 'train-2',
        delayMinutes: 60,
      });

      expect(result.success).toBe(true);
      const hotelImpact = result.impacts.find((i) => i.bookingId === 'hotel-1');
      expect(hotelImpact?.status).toBe('unaffected');
      expect(hotelImpact?.cause).toContain('Arrival precedes confirmed check-in cutoff');
      expect(hotelImpact?.explanation).toContain('The reservation is confirmed safe');
    });

    it('marks hotel atRisk when cutoff is unverified and upstream feeder is delayed', () => {
      const hotelWithoutCutoff: Booking = {
        ...hotelBooking,
        arrivalDeadline: undefined, // Unverified cutoff
      };

      const trip: Trip = {
        ...baseTrip,
        bookings: [train1, train2, hotelWithoutCutoff],
      };

      // Delay train-2 by 60 mins
      const result = propagateDisruption(trip, {
        type: 'delay',
        targetBookingId: 'train-2',
        delayMinutes: 60,
      });

      expect(result.success).toBe(true);
      const hotelImpact = result.impacts.find((i) => i.bookingId === 'hotel-1');
      expect(hotelImpact?.status).toBe('atRisk');
      expect(hotelImpact?.cause).toContain('Unverified check-in cutoff');
      expect(hotelImpact?.explanation).toContain('no evidence that the reservation is lost');
      // Engine must not make an unsupported claim that it is definitely unaffected
      expect(hotelImpact?.status).not.toBe('unaffected');
    });

    it('never invents cancellation penalties, no-show outcomes, room release, or provider policies', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'cancellation',
        targetBookingId: 'train-1',
      });

      const hotelImpact = result.impacts.find((i) => i.bookingId === 'hotel-1');
      expect(hotelImpact?.status).toBe('atRisk');
      expect(hotelImpact?.explanation).not.toContain('non-refundable fee');
      expect(hotelImpact?.explanation).not.toContain('room released');
      expect(hotelImpact?.explanation).not.toContain('penalty of');
      expect(hotelImpact?.explanation).toContain('not automatically lost or non-refundable; traveller should contact property');
    });
  });

  describe('Milestone 2.1: 4. Revised Arrival Time and Delay Validation', () => {
    it('rejects fractional delayMinutes values', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 12.5,
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('finite integer'))).toBe(true);
    });

    it('rejects negative delayMinutes values', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: -15,
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('non-negative number of minutes'))).toBe(true);
    });

    it('rejects NaN and Infinity delayMinutes values', () => {
      const resultNaN = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: NaN,
      });
      expect(resultNaN.success).toBe(false);

      const resultInf = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: Infinity,
      });
      expect(resultInf.success).toBe(false);
    });

    it('accepts zero-minute delay and preserves schedule without shifting', () => {
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 0,
      });

      expect(result.success).toBe(true);
      const impact = result.impacts.find((i) => i.bookingId === 'train-1');
      expect(impact?.status).toBe('unaffected');
      expect(impact?.scheduleChanged).toBe(false);
      expect(impact?.revisedStartTime).toBe(train1.startTime);
      expect(impact?.revisedEndTime).toBe(train1.endTime);
    });

    it('accepts very large delay values with deterministic calculations', () => {
      // 2880 minutes = 48 hours
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 2880,
      });

      expect(result.success).toBe(true);
      const impact = result.impacts.find((i) => i.bookingId === 'train-1');
      expect(impact?.status).toBe('affected');
      expect(impact?.scheduleChanged).toBe(true);
      expect(impact?.revisedStartTime).toBe('2026-11-22T06:00:00.000Z');
      expect(impact?.revisedEndTime).toBe('2026-11-22T10:00:00.000Z');
    });

    it('rejects contradictory inputs when revisedArrivalTime contradicts delayMinutes', () => {
      // train-1 scheduled arrival is 10:00 UTC. delayMinutes is 30 (expected 10:30 UTC).
      // contradictory revisedArrivalTime is 12:00 UTC (90 minutes difference).
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
        revisedArrivalTime: '2026-11-20T12:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.includes('Contradictory disruption input'))).toBe(true);
    });

    it('accepts consistent revisedArrivalTime matching scheduled arrival plus delayMinutes', () => {
      // train-1 scheduled arrival is 10:00 UTC. delayMinutes is 30.
      // revisedArrivalTime is 10:30 UTC.
      const result = propagateDisruption(baseTrip, {
        type: 'delay',
        targetBookingId: 'train-1',
        delayMinutes: 30,
        revisedArrivalTime: '2026-11-20T10:30:00Z',
      });

      expect(result.success).toBe(true);
      const impact = result.impacts.find((i) => i.bookingId === 'train-1');
      expect(impact?.revisedEndTime).toBe('2026-11-20T10:30:00Z');
    });
  });

  describe('Milestone 2.1: 5. Dependency Validation Error Collection Order Independence', () => {
    const invalidBufferDep: BookingDependency = {
      id: 'dep-invalid-buffer',
      upstreamBookingId: 'train-1',
      downstreamBookingId: 'train-2',
      relationshipType: 'transit-connection',
      requiredBufferMinutes: -20, // Negative buffer
      commitmentType: 'hard',
    };

    const nonexistentDep: BookingDependency = {
      id: 'dep-nonexistent-booking',
      upstreamBookingId: 'nonexistent-upstream',
      downstreamBookingId: 'train-2',
      relationshipType: 'transit-connection',
      commitmentType: 'hard',
    };

    const selfDep: BookingDependency = {
      id: 'dep-self-reference',
      upstreamBookingId: 'train-1',
      downstreamBookingId: 'train-1',
      relationshipType: 'transit-connection',
      commitmentType: 'hard',
    };

    const invalidCommitmentDep: BookingDependency = {
      id: 'dep-bad-commitment',
      upstreamBookingId: 'train-1',
      downstreamBookingId: 'train-2',
      relationshipType: 'transit-connection',
      commitmentType: 'unsupported-commitment' as unknown as BookingCommitmentType,
    };

    it('produces identical error sets regardless of item order among multiple invalid dependency entries', () => {
      const orderA = [invalidBufferDep, nonexistentDep, selfDep, invalidCommitmentDep];
      const orderB = [invalidCommitmentDep, selfDep, nonexistentDep, invalidBufferDep];
      const orderC = [nonexistentDep, invalidCommitmentDep, invalidBufferDep, selfDep];

      const resA = validateDependencies(orderA, baseTrip.bookings);
      const resB = validateDependencies(orderB, baseTrip.bookings);
      const resC = validateDependencies(orderC, baseTrip.bookings);

      expect(resA.success).toBe(false);
      expect(resB.success).toBe(false);
      expect(resC.success).toBe(false);

      // Confirm exact same errors are reported regardless of order
      expect(new Set(resA.errors)).toEqual(new Set(resB.errors));
      expect(new Set(resB.errors)).toEqual(new Set(resC.errors));
    });

    it('detects graph cycles on structurally valid entries even when an invalid entry is positioned before, between, or after them', () => {
      const cycleDep1: BookingDependency = {
        id: 'cycle-1',
        upstreamBookingId: 'train-1',
        downstreamBookingId: 'train-2',
        relationshipType: 'transit-connection',
        commitmentType: 'hard',
      };

      const cycleDep2: BookingDependency = {
        id: 'cycle-2',
        upstreamBookingId: 'train-2',
        downstreamBookingId: 'train-1',
        relationshipType: 'transit-connection',
        commitmentType: 'hard',
      };

      // Invalid entry at beginning, middle, and end
      const orderBefore = [invalidBufferDep, cycleDep1, cycleDep2];
      const orderBetween = [cycleDep1, invalidBufferDep, cycleDep2];
      const orderAfter = [cycleDep1, cycleDep2, invalidBufferDep];

      const resBefore = validateDependencies(orderBefore, baseTrip.bookings);
      const resBetween = validateDependencies(orderBetween, baseTrip.bookings);
      const resAfter = validateDependencies(orderAfter, baseTrip.bookings);

      // All 3 must detect the cycle AND report the buffer error
      for (const res of [resBefore, resBetween, resAfter]) {
        expect(res.success).toBe(false);
        expect(res.errors.some((e) => e.includes('Dependency cycle detected'))).toBe(true);
        expect(res.errors.some((e) => e.includes('requiredBufferMinutes, if specified, must be a non-negative number'))).toBe(true);
      }

      expect(new Set(resBefore.errors)).toEqual(new Set(resBetween.errors));
      expect(new Set(resBetween.errors)).toEqual(new Set(resAfter.errors));
    });
  });
});
