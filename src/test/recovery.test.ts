import { describe, it, expect } from 'vitest';
import {
  generateRecoveryPlans,
  generateActionPlan,
  validateRecoveryOption,
  classifyBookingRefundability,
} from '../domain/recovery/recovery.engine';
import {
  RecoveryOption,
  UserRecoveryConstraints,
} from '../domain/recovery/recovery.types';
import { Booking } from '../domain/bookings/booking.types';
import { SAMPLE_TRIP, DEMO_RECOVERY_OPTIONS, DEMO_DISRUPTION } from '../lib/demo-data';
import { propagateDisruption } from '../domain/disruptions/propagation.engine';

describe('Milestone 3: Recovery Planning MVP Engine', () => {
  const disruptionResult = propagateDisruption(SAMPLE_TRIP, DEMO_DISRUPTION);

  it('validates candidate recovery options and rejects empty timestamps', () => {
    const invalidOption = {
      id: 'opt-bad',
      tripId: SAMPLE_TRIP.id,
      title: 'Invalid Option',
      description: 'Bad option with empty string deadline',
      type: 'alternative-transport',
      additionalCost: 1000,
      currency: 'INR',
      targetBookingId: 'demo-booking-flight-1',
      deadline: '', // Empty string must be rejected
      isSimulated: true,
    };

    const result = validateRecoveryOption(invalidOption);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Deadline, if specified, must be a non-empty valid date/time string'))).toBe(true);
  });

  it('validates candidate recovery options and preserves unknown deadlines when undefined', () => {
    const validOption = {
      id: 'opt-valid',
      tripId: SAMPLE_TRIP.id,
      title: 'Valid Option',
      description: 'Valid option without deadline',
      type: 'local-transport',
      additionalCost: 800,
      currency: 'INR',
      targetBookingId: 'demo-booking-flight-1',
      isSimulated: false,
    };

    const result = validateRecoveryOption(validOption);
    expect(result.success).toBe(true);
    expect(result.data?.deadline).toBeUndefined();
    expect(result.data?.deadlineType).toBe('unknown');
  });

  it('enforces budget constraint (rejects or marks plans exceeding maxBudget as infeasible)', () => {
    // Flight plan costs ₹4,200 + ₹1,200 (cab) = ₹5,400
    // Set budget to ₹3,000
    const constraints: UserRecoveryConstraints = {
      priority: 'minimize-cost',
      maxBudget: 3000,
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    // The flight plan requires 5400, which exceeds 3000
    const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'));
    expect(flightPlan).toBeDefined();
    expect(flightPlan?.isFeasible).toBe(false);
    expect(flightPlan?.isFallback).toBe(true);
    expect(flightPlan?.infeasibilityReasons.some((r) => r.includes('Exceeds maximum recovery budget'))).toBe(true);

    // Train plan costs 950 <= 3000, so it remains feasible
    const trainPlan = plans.find((p) => p.name.includes('Budget Train'));
    expect(trainPlan).toBeDefined();
    expect(trainPlan?.isFeasible).toBe(true);
  });

  it('enforces activity deadline feasibility against non-negotiable critical booking constraints', () => {
    // Mark scuba diving booking as a non-negotiable critical commitment
    const constraints: UserRecoveryConstraints = {
      priority: 'preserve-activity',
      criticalBookingIds: ['demo-booking-scuba-1'],
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    // Alternative flight plan arrives at 13:00 / 14:15, in time for morning scuba -> Feasible
    const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'));
    expect(flightPlan?.isFeasible).toBe(true);
    const scubaInFlight = flightPlan?.commitments.find((c) => c.bookingId === 'demo-booking-scuba-1');
    expect(scubaInFlight?.status).toBe('preserved');

    // Budget train plan arrives at 20:30, violating scuba dive cutoff -> Infeasible
    const trainPlan = plans.find((p) => p.name.includes('Budget Train'));
    expect(trainPlan?.isFeasible).toBe(false);
    expect(trainPlan?.isFallback).toBe(true);
    expect(trainPlan?.infeasibilityReasons.some((r) => r.includes('Fails to preserve non-negotiable commitment'))).toBe(true);
  });

  it('strictly distinguishes additional recovery spending from known non-refundable cash loss', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'minimize-cost',
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    // Flight plan: High additional spending (₹5,400), zero non-refundable cash loss (scuba preserved)
    const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'));
    expect(flightPlan?.additionalSpending).toBe(5400);
    expect(flightPlan?.nonRefundableCashLoss).toBe(0);

    // Train plan: Low additional spending (₹950), high non-refundable cash loss (₹4,200 prepaid scuba forfeited)
    const trainPlan = plans.find((p) => p.name.includes('Budget Train'));
    expect(trainPlan?.additionalSpending).toBe(950);
    expect(trainPlan?.nonRefundableCashLoss).toBe(4200);

    // Verification: spending and cash loss are stored and calculated as independent fields
    expect(trainPlan?.additionalSpending).not.toBe(trainPlan?.nonRefundableCashLoss);
  });

  it('preserves personal experience value as a separate dimension without combining into monetary sum', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'minimize-cost',
      experienceValuePerBooking: {
        'demo-booking-scuba-1': 85, // 85 subjective experience points
      },
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    const trainPlan = plans.find((p) => p.name.includes('Budget Train'));
    expect(trainPlan?.experienceValueLost).toBe(85);
    // Ensure experience value (85) was NOT added into monetary spending (950) or cash loss (4200)
    expect(trainPlan?.additionalSpending).toBe(950);
    expect(trainPlan?.nonRefundableCashLoss).toBe(4200);

    const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'));
    expect(flightPlan?.experienceValueLost).toBe(0);
  });

  it('orders plans according to user priority: minimize-cost', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'minimize-cost',
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]!.name).toContain('Budget Train');
    expect(plans[0]!.isRecommended).toBe(true);
    expect(plans[0]!.recommendationReason).toContain('minimizes extra out-of-pocket spending');
  });

  it('orders plans according to user priority: preserve-activity', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'preserve-activity',
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]!.name).toContain('Alternative Flight');
    expect(plans[0]!.isRecommended).toBe(true);
    expect(plans[0]!.recommendationReason).toContain('successfully preserves your scheduled activities');
  });

  it('orders plans according to user priority: earliest-arrival', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'earliest-arrival',
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]!.name).toContain('Alternative Flight');
    expect(plans[0]!.isRecommended).toBe(true);
    expect(plans[0]!.recommendationReason).toContain('earliest arrival');
  });

  it('correctly handles unknown deadlines with explicit provider confirmation message', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'preserve-activity',
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'))!;
    const actions = generateActionPlan(flightPlan, SAMPLE_TRIP);

    // Verify cab action has unknown deadline and explicit prompt
    const cabAction = actions.find((a) => a.action.includes('ground transit'));
    expect(cabAction).toBeDefined();
    expect(cabAction?.deadlineType).toBe('unknown');
    expect(cabAction?.deadlineDisplay).toBe('Confirm deadline with provider.');
  });

  it('orders known deadlines first while respecting prerequisites in action plan', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'preserve-activity',
    };

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      constraints
    );

    const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'))!;
    const actions = generateActionPlan(flightPlan, SAMPLE_TRIP);

    expect(actions.length).toBeGreaterThan(0);

    // Step numbers must be 1, 2, 3...
    actions.forEach((act, idx) => {
      expect(act.stepNumber).toBe(idx + 1);
    });

    // Known deadline actions must appear before unknown deadline actions when not constrained by prerequisites
    const firstUnknownIndex = actions.findIndex((a) => a.deadlineType === 'unknown');
    if (firstUnknownIndex !== -1) {
      // Any subsequent action that has a known deadline must have had a prerequisite
      const laterKnown = actions.slice(firstUnknownIndex + 1).find((a) => a.deadlineType === 'user-entered');
      if (laterKnown) {
        expect(laterKnown.prerequisiteStepIds.length).toBeGreaterThan(0);
      }
    }
  });

  it('supports user-entered local transport options with cost and timing in recovery comparison', () => {
    const customLocalTransport: RecoveryOption = {
      id: 'custom-local-metro',
      tripId: SAMPLE_TRIP.id,
      title: 'Express Airport Metro Feeder',
      description: 'Direct metro feeder to South Goa express hub, estimated fare ₹180',
      type: 'local-transport',
      additionalCost: 180,
      currency: 'INR',
      targetBookingId: 'demo-booking-flight-1',
      expectedDepartureTime: '2026-11-12T13:30:00+05:30',
      expectedArrivalTime: '2026-11-12T14:45:00+05:30',
      deadlineType: 'unknown',
      isSimulated: false, // User entered!
    };

    const optionsWithCustom: RecoveryOption[] = [
      ...DEMO_RECOVERY_OPTIONS as RecoveryOption[],
      customLocalTransport,
    ];

    const plans = generateRecoveryPlans(
      SAMPLE_TRIP,
      disruptionResult,
      optionsWithCustom,
      { priority: 'minimize-cost' }
    );

    // Verify plans include assumptions about user-entered local transport
    const planWithCab = plans.find((p) => p.name.includes('Alternative Flight'));
    expect(planWithCab?.assumptionsAndUnknowns.some((a) => a.includes('Local transport fare and transit duration are user/operator estimates'))).toBe(true);
  });

  it('produces 100% deterministic plan outputs for the demo scenario', () => {
    const constraints: UserRecoveryConstraints = {
      priority: 'preserve-activity',
      experienceValuePerBooking: { 'demo-booking-scuba-1': 50 },
    };

    const run1 = generateRecoveryPlans(SAMPLE_TRIP, disruptionResult, DEMO_RECOVERY_OPTIONS as RecoveryOption[], constraints);
    const run2 = generateRecoveryPlans(SAMPLE_TRIP, disruptionResult, DEMO_RECOVERY_OPTIONS as RecoveryOption[], constraints);

    expect(JSON.stringify(run1)).toEqual(JSON.stringify(run2));
  });
});

describe('Milestone 3.1: Critical Correctness Pass', () => {
  const disruptionResult = propagateDisruption(SAMPLE_TRIP, DEMO_DISRUPTION);

  describe('Deterministic Refund Classification', () => {
    const sampleBooking: Booking = {
      id: 'book-refund-test',
      tripId: SAMPLE_TRIP.id,
      type: 'activity',
      provider: 'Sunset Cruise',
      location: 'Goa',
      cost: 2500,
      currency: 'INR',
      status: 'confirmed',
      cancellationDeadline: '2026-11-12T10:00:00+05:30',
      cancellationPolicyNotes: 'Free cancellation up to cutoff; non-refundable thereafter.',
    };

    it('classifies as refundable when evaluation reference time precedes cancellation deadline', () => {
      // Reference time 08:00 is before deadline 10:00
      const result = classifyBookingRefundability(sampleBooking, '2026-11-12T08:00:00+05:30');
      expect(result.status).toBe('refundable');
      expect(result.isNonRefundable).toBe(false);
      expect(result.explanation).toContain('precedes cancellation deadline');
    });

    it('classifies as non-refundable when evaluation reference time passes cancellation deadline', () => {
      // Reference time 11:00 is after deadline 10:00
      const result = classifyBookingRefundability(sampleBooking, '2026-11-12T11:00:00+05:30');
      expect(result.status).toBe('non-refundable');
      expect(result.isNonRefundable).toBe(true);
      expect(result.explanation).toContain('passed relative to evaluation reference time');
    });

    it('represents refundability as unknown when cancellation policy notes are missing', () => {
      const unrecordedPolicyBooking: Booking = {
        ...sampleBooking,
        cancellationPolicyNotes: undefined,
        cancellationDeadline: undefined,
      };

      const result = classifyBookingRefundability(unrecordedPolicyBooking, '2026-11-12T08:00:00+05:30');
      expect(result.status).toBe('unknown');
      expect(result.isNonRefundable).toBe(false);
      expect(result.explanation).toContain('No cancellation policy recorded');
    });

    it('represents refundability as unknown when policy is conditional but cutoff timestamp is missing', () => {
      const vaguePolicyBooking: Booking = {
        ...sampleBooking,
        cancellationPolicyNotes: 'Airline fee applies within 24 hours of flight departure.',
        cancellationDeadline: undefined, // missing exact deadline timestamp
      };

      const result = classifyBookingRefundability(vaguePolicyBooking, '2026-11-12T08:00:00+05:30');
      expect(result.status).toBe('unknown');
      expect(result.isNonRefundable).toBe(false);
      expect(result.explanation).toContain('exact cancellation cutoff timestamp is unrecorded');
    });

    it('isolates unknown refund losses into unknownRefundLoss without conflating with confirmed cash loss', () => {
      // Trip with an unrecorded-policy activity that is missed
      const tripWithUnrecordedPolicy: typeof SAMPLE_TRIP = {
        ...SAMPLE_TRIP,
        bookings: SAMPLE_TRIP.bookings.map((b) =>
          b.id === 'demo-booking-scuba-1'
            ? { ...b, cancellationPolicyNotes: undefined, cancellationDeadline: undefined }
            : b
        ),
      };

      const plans = generateRecoveryPlans(
        tripWithUnrecordedPolicy,
        disruptionResult,
        DEMO_RECOVERY_OPTIONS as RecoveryOption[],
        { priority: 'minimize-cost' }
      );

      const trainPlan = plans.find((p) => p.name.includes('Budget Train'));
      expect(trainPlan).toBeDefined();
      // Scuba is missed, but policy is unrecorded, so confirmed nonRefundableCashLoss is 0,
      // and unknownRefundLoss is 4200
      expect(trainPlan?.nonRefundableCashLoss).toBe(0);
      expect(trainPlan?.unknownRefundLoss).toBe(4200);
      expect(trainPlan?.assumptionsAndUnknowns.some((a) => a.includes('unconfirmed by provider; treated as unknown'))).toBe(true);
    });
  });

  describe('Recovery Plan Grouping & Cost Deduplication', () => {
    it('does not pair unrelated local transport merely because it shares a booking ID', () => {
      const options: RecoveryOption[] = [
        {
          id: 'opt-flight',
          tripId: SAMPLE_TRIP.id,
          title: 'Morning Replacement Flight',
          description: 'Flight',
          type: 'alternative-transport',
          additionalCost: 3500,
          currency: 'INR',
          targetBookingId: 'demo-booking-flight-1',
          deadlineType: 'unknown',
          isSimulated: true,
        },
        {
          id: 'opt-train',
          tripId: SAMPLE_TRIP.id,
          title: 'Afternoon Rail',
          description: 'Rail',
          type: 'alternative-transport',
          additionalCost: 800,
          currency: 'INR',
          targetBookingId: 'demo-booking-flight-1',
          deadlineType: 'unknown',
          isSimulated: true,
        },
        {
          id: 'opt-airport-cab',
          tripId: SAMPLE_TRIP.id,
          title: 'Airport Taxi',
          description: 'Airport cab specifically targeting flight arrival',
          type: 'local-transport',
          additionalCost: 1100,
          currency: 'INR',
          targetBookingId: 'opt-flight', // Genuinely compatible with flight ONLY
          deadlineType: 'unknown',
          isSimulated: false,
        },
      ];

      const plans = generateRecoveryPlans(SAMPLE_TRIP, disruptionResult, options, {
        priority: 'minimize-cost',
      });

      const flightPlan = plans.find((p) => p.name.includes('Morning Replacement Flight'));
      const trainPlan = plans.find((p) => p.name.includes('Afternoon Rail'));

      // Flight plan should include the airport taxi (3500 + 1100 = 4600)
      expect(flightPlan?.options.some((o) => o.id === 'opt-airport-cab')).toBe(true);
      expect(flightPlan?.additionalSpending).toBe(4600);

      // Train plan must NOT include the airport taxi
      expect(trainPlan?.options.some((o) => o.id === 'opt-airport-cab')).toBe(false);
      expect(trainPlan?.additionalSpending).toBe(800);
    });

    it('avoids double-counting option costs when options are duplicated', () => {
      const duplicatedOptions: RecoveryOption[] = [
        DEMO_RECOVERY_OPTIONS[0] as RecoveryOption,
        DEMO_RECOVERY_OPTIONS[0] as RecoveryOption, // exact duplicate candidate
        DEMO_RECOVERY_OPTIONS[2] as RecoveryOption, // airport cab
      ];

      const plans = generateRecoveryPlans(SAMPLE_TRIP, disruptionResult, duplicatedOptions, {
        priority: 'minimize-cost',
      });

      const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'));
      // 4200 (flight) + 1200 (cab) = 5400, not 4200 + 4200 + 1200 = 9600
      expect(flightPlan?.additionalSpending).toBe(5400);
    });

    it('generates a distinct standalone plan for unlinked user-entered local transport', () => {
      const standaloneMetro: RecoveryOption = {
        id: 'opt-metro-standalone',
        tripId: SAMPLE_TRIP.id,
        title: 'City Express Metro Line',
        description: 'Direct metro journey from station to hotel',
        type: 'local-transport',
        additionalCost: 150,
        currency: 'INR',
        targetBookingId: 'some-other-booking',
        deadlineType: 'unknown',
        isSimulated: false,
      };

      const plans = generateRecoveryPlans(
        SAMPLE_TRIP,
        disruptionResult,
        [...(DEMO_RECOVERY_OPTIONS as RecoveryOption[]), standaloneMetro],
        { priority: 'minimize-cost' }
      );

      const metroPlan = plans.find((p) => p.name === 'City Express Metro Line');
      expect(metroPlan).toBeDefined();
      expect(metroPlan?.options).toHaveLength(1);
      expect(metroPlan?.additionalSpending).toBe(150);
    });
  });

  describe('Feasibility Enforcement & Priority Recommendations', () => {
    it('marks a plan infeasible when timing is unknown for a non-negotiable critical booking', () => {
      const tripWithUnscheduledActivity: typeof SAMPLE_TRIP = {
        ...SAMPLE_TRIP,
        bookings: SAMPLE_TRIP.bookings.map((b) =>
          b.id === 'demo-booking-scuba-1'
            ? { ...b, startTime: undefined, arrivalDeadline: undefined } // unscheduled timing
            : b
        ),
      };

      const plans = generateRecoveryPlans(
        tripWithUnscheduledActivity,
        disruptionResult,
        DEMO_RECOVERY_OPTIONS as RecoveryOption[],
        {
          priority: 'preserve-activity',
          criticalBookingIds: ['demo-booking-scuba-1'],
        }
      );

      // Because timing is unknown, scuba cannot be verified, so plan is not marked feasible
      const flightPlan = plans.find((p) => p.name.includes('Alternative Flight'));
      expect(flightPlan?.isFeasible).toBe(false);
      expect(flightPlan?.isFallback).toBe(true);
      expect(flightPlan?.infeasibilityReasons.some((r) => r.includes('Cannot confirm non-negotiable commitment'))).toBe(true);
    });

    it('correctly adapts recommendation across all three priorities: minimize-cost, preserve-activity, earliest-arrival', () => {
      // 1. minimize-cost -> Train plan wins (₹950 extra spend vs ₹5,400)
      const costPlans = generateRecoveryPlans(
        SAMPLE_TRIP,
        disruptionResult,
        DEMO_RECOVERY_OPTIONS as RecoveryOption[],
        { priority: 'minimize-cost' }
      );
      expect(costPlans[0]!.name).toContain('Budget Train');
      expect(costPlans[0]!.recommendationReason).toContain('minimizes extra out-of-pocket spending');

      // 2. preserve-activity -> Flight plan wins (preserves Scuba vs misses Scuba)
      const actPlans = generateRecoveryPlans(
        SAMPLE_TRIP,
        disruptionResult,
        DEMO_RECOVERY_OPTIONS as RecoveryOption[],
        { priority: 'preserve-activity' }
      );
      expect(actPlans[0]!.name).toContain('Alternative Flight');
      expect(actPlans[0]!.recommendationReason).toContain('successfully preserves your scheduled activities');

      // 3. earliest-arrival -> Flight plan wins (arrives 14:15 vs 20:30)
      const earlyPlans = generateRecoveryPlans(
        SAMPLE_TRIP,
        disruptionResult,
        DEMO_RECOVERY_OPTIONS as RecoveryOption[],
        { priority: 'earliest-arrival' }
      );
      expect(earlyPlans[0]!.name).toContain('Alternative Flight');
      expect(earlyPlans[0]!.recommendationReason).toContain('earliest arrival');
    });
  });
});
