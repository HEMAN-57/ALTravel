/**
 * Milestone 3: Recovery Planning MVP Engine
 * Deterministic plan comparison, feasibility enforcement, and action plan generation.
 */

import { Trip } from '../trips/trip.types';
import { Booking } from '../bookings/booking.types';
import { DisruptionPropagationResult } from '../disruptions/disruption.types';
import {
  RecoveryOption,
  RecoveryPlan,
  ActionItem,
  UserRecoveryConstraints,
  PlanCommitmentOutcome,
  RefundEligibility,
} from './recovery.types';
import { isValidDateString } from '../bookings/booking.validation';

/**
 * Validates candidate recovery option payload.
 */
export function validateRecoveryOption(
  input: unknown
): { success: boolean; errors: string[]; data?: RecoveryOption } {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { success: false, errors: ['Recovery option must be a non-null object.'] };
  }

  const candidate = input as Record<string, unknown>;

  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    errors.push('Option ID is required.');
  }

  if (typeof candidate.tripId !== 'string' || candidate.tripId.trim() === '') {
    errors.push('Trip ID is required.');
  }

  if (typeof candidate.title !== 'string' || candidate.title.trim() === '') {
    errors.push('Title is required.');
  }

  if (typeof candidate.description !== 'string' || candidate.description.trim() === '') {
    errors.push('Description is required.');
  }

  const validTypes = [
    'alternative-transport',
    'local-transport',
    'contact-provider',
    'reschedule',
    'drop-commitment',
  ];
  if (typeof candidate.type !== 'string' || !validTypes.includes(candidate.type)) {
    errors.push(`Type must be one of: ${validTypes.join(', ')}.`);
  }

  if (typeof candidate.additionalCost !== 'number' || Number.isNaN(candidate.additionalCost) || candidate.additionalCost < 0) {
    errors.push('Additional cost must be a non-negative number.');
  }

  if (typeof candidate.currency !== 'string' || candidate.currency.trim() === '') {
    errors.push('Currency is required.');
  }

  if (typeof candidate.targetBookingId !== 'string' || candidate.targetBookingId.trim() === '') {
    errors.push('Target booking ID is required.');
  }

  // Validate optional timestamps (reject empty strings)
  if (candidate.expectedDepartureTime !== undefined && candidate.expectedDepartureTime !== null) {
    if (typeof candidate.expectedDepartureTime !== 'string' || !isValidDateString(candidate.expectedDepartureTime)) {
      errors.push('Expected departure time, if specified, must be a valid date/time string.');
    }
  }

  if (candidate.expectedArrivalTime !== undefined && candidate.expectedArrivalTime !== null) {
    if (typeof candidate.expectedArrivalTime !== 'string' || !isValidDateString(candidate.expectedArrivalTime)) {
      errors.push('Expected arrival time, if specified, must be a valid date/time string.');
    }
  }

  let deadline: string | undefined = undefined;
  let deadlineType: 'user-entered' | 'unknown' = 'unknown';

  if (candidate.deadline !== undefined && candidate.deadline !== null) {
    if (typeof candidate.deadline !== 'string' || candidate.deadline.trim() === '') {
      errors.push('Deadline, if specified, must be a non-empty valid date/time string.');
    } else if (!isValidDateString(candidate.deadline)) {
      errors.push('Deadline must be a valid date/time string.');
    } else {
      deadline = candidate.deadline;
      deadlineType = 'user-entered';
    }
  }

  if (typeof candidate.isSimulated !== 'boolean') {
    errors.push('isSimulated flag must be an explicit boolean.');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const validated: RecoveryOption = {
    id: candidate.id as string,
    tripId: candidate.tripId as string,
    title: (candidate.title as string).trim(),
    description: (candidate.description as string).trim(),
    type: candidate.type as RecoveryOption['type'],
    additionalCost: candidate.additionalCost as number,
    currency: (candidate.currency as string).trim().toUpperCase(),
    targetBookingId: candidate.targetBookingId as string,
    expectedDepartureTime: candidate.expectedDepartureTime as string | undefined,
    expectedArrivalTime: candidate.expectedArrivalTime as string | undefined,
    deadline,
    deadlineType,
    isSimulated: candidate.isSimulated as boolean,
    notes: typeof candidate.notes === 'string' ? candidate.notes.trim() : undefined,
  };

  return { success: true, data: validated, errors: [] };
}

/**
 * Result of deterministic refundability classification.
 */
export interface RefundClassification {
  status: RefundEligibility;
  isNonRefundable: boolean;
  explanation: string;
}

/**
 * Deterministically classifies refundability for a booking based on explicit policy data
 * and an evaluation reference timestamp (never relies on non-deterministic Date.now()).
 * If refundability cannot be established from recorded data, it is marked as 'unknown'.
 */
export function classifyBookingRefundability(
  booking: Booking,
  evaluationReferenceTime: string
): RefundClassification {
  if (!booking.cost || booking.cost <= 0) {
    return {
      status: 'refundable',
      isNonRefundable: false,
      explanation: 'No financial cost committed to this booking.',
    };
  }

  // If no cancellation policy is recorded, refundability cannot be established
  if (!booking.cancellationPolicyNotes || booking.cancellationPolicyNotes.trim() === '') {
    return {
      status: 'unknown',
      isNonRefundable: false,
      explanation: 'No cancellation policy recorded by provider; refund eligibility is unconfirmed.',
    };
  }

  const notes = booking.cancellationPolicyNotes.toLowerCase();

  // Explicit non-refundable policy without deadline condition
  if (
    (notes.includes('non-refundable') || notes.includes('non refundable') || notes.includes('retained') || notes.includes('forfeited')) &&
    !notes.includes('free reschedule') &&
    !notes.includes('100% refund') &&
    !booking.cancellationDeadline
  ) {
    return {
      status: 'non-refundable',
      isNonRefundable: true,
      explanation: 'Provider terms state booking is explicitly non-refundable.',
    };
  }

  // Explicit 100% refund / free cancellation without cutoff deadline
  if (
    (notes.includes('100% refund') || notes.includes('free cancellation')) &&
    !booking.cancellationDeadline &&
    !notes.includes('prior')
  ) {
    return {
      status: 'refundable',
      isNonRefundable: false,
      explanation: 'Provider terms state booking is fully refundable.',
    };
  }

  // Evaluation against recorded cancellation deadline
  if (booking.cancellationDeadline) {
    const evalMs = Date.parse(evaluationReferenceTime);
    const deadlineMs = Date.parse(booking.cancellationDeadline);

    if (Number.isNaN(evalMs) || Number.isNaN(deadlineMs)) {
      return {
        status: 'unknown',
        isNonRefundable: false,
        explanation: 'Invalid reference or cancellation timestamp prevented deterministic cutoff check.',
      };
    }

    if (evalMs > deadlineMs) {
      return {
        status: 'non-refundable',
        isNonRefundable: true,
        explanation: `Cancellation deadline (${booking.cancellationDeadline}) passed relative to evaluation reference time (${evaluationReferenceTime}); non-refundable per provider policy.`,
      };
    } else {
      return {
        status: 'refundable',
        isNonRefundable: false,
        explanation: `Evaluation reference time (${evaluationReferenceTime}) precedes cancellation deadline (${booking.cancellationDeadline}); eligible for refund/credit per provider policy.`,
      };
    }
  }

  // Conditional policy phrases without recorded cancellationDeadline timestamp
  if (notes.includes('within') || notes.includes('prior') || notes.includes('fee')) {
    return {
      status: 'unknown',
      isNonRefundable: false,
      explanation: 'Provider policy specifies conditional refund terms, but exact cancellation cutoff timestamp is unrecorded.',
    };
  }

  return {
    status: 'unknown',
    isNonRefundable: false,
    explanation: 'Provider cancellation policy is unverified.',
  };
}

/**
 * Evaluates candidate recovery options into comparable recovery plans.
 */
export function generateRecoveryPlans(
  trip: Trip,
  disruptionResult: DisruptionPropagationResult | null,
  candidateOptions: RecoveryOption[],
  constraints: UserRecoveryConstraints
): RecoveryPlan[] {
  if (candidateOptions.length === 0) {
    return [];
  }

  const currency = trip.bookings[0]?.currency || 'INR';

  // Deterministic evaluation reference time: explicit constraint, disruption time, or trip start
  const evaluationReferenceTime =
    constraints.evaluationTime ||
    disruptionResult?.targetDisruption?.originalStartTime ||
    trip.bookings[0]?.startTime ||
    trip.startDate;

  // Deduplicate candidate options by ID to avoid double-processing
  const uniqueCandidateMap = new Map<string, RecoveryOption>();
  for (const opt of candidateOptions) {
    uniqueCandidateMap.set(opt.id, opt);
  }
  const cleanOptions = Array.from(uniqueCandidateMap.values());

  const primaryOptions = cleanOptions.filter(
    (opt) => opt.type === 'alternative-transport' || opt.type === 'reschedule' || opt.type === 'drop-commitment'
  );
  const localTransportOptions = cleanOptions.filter(
    (opt) => opt.type === 'local-transport'
  );
  const supportOptions = cleanOptions.filter(
    (opt) => opt.type === 'contact-provider'
  );

  // Form defensible, genuinely compatible plans:
  // Rule 1: A local transport option is paired with a primary option ONLY when explicitly linked (loc.targetBookingId === prim.id).
  //         It is never paired merely because they address the same original disrupted booking.
  // Rule 2: A support option (e.g. hotel late check-in) is paired ONLY if explicitly linked or genuinely needed due to late arrival.
  // Rule 3: Standalone local transport or independent options form their own distinct plan.
  const planDefinitions: { name: string; description: string; options: RecoveryOption[] }[] = [];

  if (primaryOptions.length > 0) {
    primaryOptions.forEach((prim) => {
      const optionsForPlan: RecoveryOption[] = [prim];

      // Genuinely compatible local transport explicitly targeting this primary option
      const relatedLocal = localTransportOptions.find(
        (loc) => loc.targetBookingId === prim.id
      );
      if (relatedLocal) {
        optionsForPlan.push(relatedLocal);
      }

      // Check if plan arrives in the evening/night (> 18:00) requiring late hotel check-in notification
      const primArrival = relatedLocal?.expectedArrivalTime || prim.expectedArrivalTime;
      const arrivesLate = primArrival ? new Date(primArrival).getHours() >= 18 : false;

      const relatedSupport = supportOptions.find((sup) => {
        if (sup.targetBookingId === prim.id) return true;
        // Genuinely relevant hotel contact for late arrival
        const targetBooking = trip.bookings.find((b) => b.id === sup.targetBookingId);
        if (targetBooking?.type === 'hotel' && arrivesLate) return true;
        return false;
      });

      if (relatedSupport) {
        optionsForPlan.push(relatedSupport);
      }

      // Deduplicate options within this plan definition
      const uniquePlanOpts = Array.from(new Map(optionsForPlan.map((o) => [o.id, o])).values());

      planDefinitions.push({
        name: relatedLocal ? `${prim.title} + ${relatedLocal.title}` : prim.title,
        description: prim.description,
        options: uniquePlanOpts,
      });
    });

    // Standalone local transport options (options that do not target a specific primary option ID)
    localTransportOptions.forEach((loc) => {
      // If loc does not target a primary option, it has standalone meaning
      const isExplicitPair = primaryOptions.some((p) => loc.targetBookingId === p.id);
      if (!isExplicitPair) {
        planDefinitions.push({
          name: loc.title,
          description: loc.description,
          options: [loc],
        });
      }
    });
  } else {
    // Treat each individual option as a candidate plan
    cleanOptions.forEach((opt) => {
      planDefinitions.push({
        name: opt.title,
        description: opt.description,
        options: [opt],
      });
    });
  }

  // Evaluate each plan
  const evaluatedPlans: RecoveryPlan[] = planDefinitions.map((planDef, index) => {
    const planId = `plan-${index + 1}`;
    // Deduplicate options to strictly avoid double-counting
    const options = Array.from(new Map(planDef.options.map((o) => [o.id, o])).values());

    // 1. Calculate Additional Spending (strictly out-of-pocket costs, counted exactly once)
    const additionalSpending = options.reduce((sum, o) => sum + (o.additionalCost || 0), 0);

    // 2. Determine estimated arrival at destination
    let estimatedArrival: string | undefined = undefined;
    for (const opt of options) {
      if (opt.expectedArrivalTime) {
        if (!estimatedArrival || new Date(opt.expectedArrivalTime) > new Date(estimatedArrival)) {
          estimatedArrival = opt.expectedArrivalTime;
        }
      }
    }

    // 3. Evaluate downstream commitments (hotel, activities, connections)
    const commitments: PlanCommitmentOutcome[] = [];
    let nonRefundableCashLoss = 0;
    let unknownRefundLoss = 0;
    let experienceValueLost = 0;
    const assumptionsAndUnknowns: string[] = [];

    // Check assumptions based on option simulation flag
    const hasSimulated = options.some((o) => o.isSimulated);
    if (hasSimulated) {
      assumptionsAndUnknowns.push(
        'Includes simulated schedule and fare data; live availability and provider confirmation required.'
      );
    }

    // Evaluate each downstream booking in the trip
    trip.bookings.forEach((booking) => {
      // If it is the disrupted booking itself (e.g. cancelled/delayed feeder flight)
      if (disruptionResult && booking.id === disruptionResult.disruptedBookingId) {
        return;
      }

      const experienceVal = constraints.experienceValuePerBooking?.[booking.id] ?? 0;

      // Determine if this booking is preserved, missed, or unknown under this plan
      let status: 'preserved' | 'missed' | 'unknown' = 'preserved';
      let reason = 'Schedule preserved by selected recovery option.';

      // Check arrival timing against booking cutoff & dependency buffers
      if (estimatedArrival && booking.startTime) {
        const arrivalTime = Date.parse(estimatedArrival);
        const bookingStart = Date.parse(booking.startTime);
        const bookingCutoff = booking.arrivalDeadline ? Date.parse(booking.arrivalDeadline) : bookingStart;

        // Check explicit dependency buffer
        const dep = trip.dependencies?.find((d) => d.downstreamBookingId === booking.id);
        const requiredBufferMinutes = dep?.requiredBufferMinutes ?? 0;
        const availableTransferMinutes = Math.floor((bookingStart - arrivalTime) / (60 * 1000));

        if (arrivalTime > bookingCutoff) {
          status = 'missed';
          reason = `Estimated arrival (${estimatedArrival}) exceeds required commitment cutoff (${booking.arrivalDeadline || booking.startTime}).`;
        } else if (requiredBufferMinutes > 0 && availableTransferMinutes < requiredBufferMinutes) {
          status = 'missed';
          reason = `Buffer deficit of ${requiredBufferMinutes - availableTransferMinutes} minutes (Available: ${availableTransferMinutes}m, Required: ${requiredBufferMinutes}m before ${booking.provider}).`;
        }
      } else if (estimatedArrival && !booking.startTime && booking.arrivalDeadline) {
        const arrivalTime = Date.parse(estimatedArrival);
        const bookingCutoff = Date.parse(booking.arrivalDeadline);
        if (arrivalTime > bookingCutoff) {
          status = 'missed';
          reason = `Estimated arrival (${estimatedArrival}) exceeds required arrival cutoff (${booking.arrivalDeadline}).`;
        }
      } else if (!booking.startTime && !booking.arrivalDeadline) {
        status = 'unknown';
        reason = 'Booking has no recorded start time or arrival cutoff; timing feasibility cannot be deterministically verified.';
        assumptionsAndUnknowns.push(
          `Feasibility for ${booking.provider} is uncertain due to missing scheduled timing.`
        );
      } else if (!estimatedArrival) {
        status = 'unknown';
        reason = 'Plan arrival timing is unrecorded; commitment feasibility cannot be deterministically verified.';
        assumptionsAndUnknowns.push(
          `Feasibility for ${booking.provider} is uncertain due to missing arrival timing.`
        );
      }

      // Check if any option explicitly drops or reschedules this booking
      const dropOpt = options.find((o) => o.targetBookingId === booking.id && o.type === 'drop-commitment');
      if (dropOpt) {
        status = 'missed';
        reason = `Commitment dropped per plan option: ${dropOpt.title}.`;
      }

      // Hotel specific late arrival check
      if (booking.type === 'hotel') {
        const hotelContactOpt = options.find((o) => o.targetBookingId === booking.id && o.type === 'contact-provider');
        if (estimatedArrival && booking.arrivalDeadline) {
          const arrivalTime = Date.parse(estimatedArrival);
          const cutoff = Date.parse(booking.arrivalDeadline);

          if (arrivalTime <= cutoff) {
            status = 'preserved';
            reason = hotelContactOpt
              ? 'Late check-in confirmed with hotel and arrival is within recorded cutoff window.'
              : 'Arrival is within recorded hotel cutoff window, though provider confirmation is advised.';
          } else if (hotelContactOpt) {
            status = 'preserved';
            reason = 'Hotel notified of late check-in beyond standard cutoff.';
          } else {
            status = 'missed';
            reason = 'Arrival exceeds hotel check-in cutoff without late check-in notification.';
          }
        }
        assumptionsAndUnknowns.push(
          "Hotel late check-in policy and room guarantee are subject to provider confirmation upon arrival."
        );
      }

      // Refund classification for missed bookings
      if (status === 'missed') {
        const refundInfo = classifyBookingRefundability(booking, evaluationReferenceTime);
        if (refundInfo.status === 'non-refundable') {
          nonRefundableCashLoss += booking.cost;
        } else if (refundInfo.status === 'unknown') {
          unknownRefundLoss += booking.cost;
          assumptionsAndUnknowns.push(
            `Refund eligibility for ${booking.provider} (${booking.cost} ${currency}) is unconfirmed by provider; treated as unknown.`
          );
        }

        // Subjective experience value lost (strictly separate metric, never added to money)
        experienceValueLost += experienceVal;

        commitments.push({
          bookingId: booking.id,
          bookingTitle: booking.provider,
          bookingType: booking.type,
          status: 'missed',
          reason,
          originalCost: booking.cost,
          refundStatus: refundInfo.status,
          isNonRefundable: refundInfo.isNonRefundable,
          refundExplanation: refundInfo.explanation,
          lostExperienceValue: experienceVal,
        });
      } else {
        commitments.push({
          bookingId: booking.id,
          bookingTitle: booking.provider,
          bookingType: booking.type,
          status,
          reason,
          originalCost: booking.cost,
          refundStatus: 'refundable',
          isNonRefundable: false,
          refundExplanation: 'Commitment retained.',
          lostExperienceValue: 0,
        });
      }
    });

    // 4. Feasibility check against hard constraints
    const infeasibilityReasons: string[] = [];
    let isFeasible = true;

    // Hard constraint: Budget limit
    if (constraints.maxBudget !== undefined && additionalSpending > constraints.maxBudget) {
      isFeasible = false;
      infeasibilityReasons.push(
        `Exceeds maximum recovery budget limit of ${constraints.maxBudget} ${currency} (Requires ${additionalSpending} ${currency}).`
      );
    }

    // Hard constraint: Non-negotiable critical commitments preserved
    if (constraints.criticalBookingIds && constraints.criticalBookingIds.length > 0) {
      for (const criticalId of constraints.criticalBookingIds) {
        const targetCommitment = commitments.find((c) => c.bookingId === criticalId);
        if (targetCommitment?.status === 'missed') {
          isFeasible = false;
          infeasibilityReasons.push(
            `Fails to preserve non-negotiable commitment "${targetCommitment.bookingTitle}" (${targetCommitment.reason}).`
          );
        } else if (targetCommitment?.status === 'unknown') {
          isFeasible = false;
          infeasibilityReasons.push(
            `Cannot confirm non-negotiable commitment "${targetCommitment.bookingTitle}" due to unrecorded timing constraints.`
          );
        }
      }
    }

    // Local transport assumption note
    const hasLocalTransport = options.some((o) => o.type === 'local-transport');
    if (hasLocalTransport) {
      assumptionsAndUnknowns.push(
        'Local transport fare and transit duration are user/operator estimates and subject to live traffic conditions.'
      );
    }

    return {
      id: planId,
      name: planDef.name,
      description: planDef.description,
      options,
      isFeasible,
      isFallback: !isFeasible,
      infeasibilityReasons,
      additionalSpending,
      nonRefundableCashLoss,
      unknownRefundLoss: unknownRefundLoss > 0 ? unknownRefundLoss : undefined,
      currency,
      experienceValueLost,
      commitments,
      estimatedArrivalAtDestination: estimatedArrival,
      assumptionsAndUnknowns,
      isRecommended: false,
      recommendationReason: '',
    };
  });

  // 5. Rank and Recommend plans based on selected user priority
  // Rule: Feasible plans always rank above infeasible fallbacks
  evaluatedPlans.sort((a, b) => {
    if (a.isFeasible !== b.isFeasible) {
      return a.isFeasible ? -1 : 1;
    }

    switch (constraints.priority) {
      case 'minimize-cost': {
        // 1. Lowest additional spending
        if (a.additionalSpending !== b.additionalSpending) {
          return a.additionalSpending - b.additionalSpending;
        }
        // 2. Lowest non-refundable cash loss
        if (a.nonRefundableCashLoss !== b.nonRefundableCashLoss) {
          return a.nonRefundableCashLoss - b.nonRefundableCashLoss;
        }
        // 3. Earliest arrival
        return compareArrivalTimes(a.estimatedArrivalAtDestination, b.estimatedArrivalAtDestination);
      }

      case 'preserve-activity': {
        // 1. Highest number of preserved activities/commitments
        const aPreserved = a.commitments.filter((c) => c.status === 'preserved').length;
        const bPreserved = b.commitments.filter((c) => c.status === 'preserved').length;
        if (aPreserved !== bPreserved) {
          return bPreserved - aPreserved;
        }
        // 2. Lowest lost experience value
        if (a.experienceValueLost !== b.experienceValueLost) {
          return a.experienceValueLost - b.experienceValueLost;
        }
        // 3. Lowest additional spending
        return a.additionalSpending - b.additionalSpending;
      }

      case 'earliest-arrival': {
        // 1. Earliest arrival
        const arrivalDiff = compareArrivalTimes(a.estimatedArrivalAtDestination, b.estimatedArrivalAtDestination);
        if (arrivalDiff !== 0) {
          return arrivalDiff;
        }
        // 2. Lowest additional spending
        return a.additionalSpending - b.additionalSpending;
      }

      default:
        return a.additionalSpending - b.additionalSpending;
    }
  });

  // Set recommendation on top plan
  if (evaluatedPlans.length > 0 && evaluatedPlans[0]) {
    const topPlan = evaluatedPlans[0];
    topPlan.isRecommended = true;

    // Explain why the recommended plan wins under the selected priority
    if (!topPlan.isFeasible) {
      topPlan.recommendationReason =
        'No plan found satisfying all explicit hard constraints. Presented as the best available fallback option.';
    } else {
      switch (constraints.priority) {
        case 'minimize-cost':
          topPlan.recommendationReason = `Recommended because it minimizes extra out-of-pocket spending to ${topPlan.additionalSpending} ${currency} under your "Minimize extra spending" priority.`;
          break;
        case 'preserve-activity':
          topPlan.recommendationReason = `Recommended because it successfully preserves your scheduled activities and commitments under your "Preserve the most important activity" priority.`;
          break;
        case 'earliest-arrival':
          topPlan.recommendationReason = `Recommended because it achieves the earliest arrival at your destination (${topPlan.estimatedArrivalAtDestination || 'N/A'}) under your "Arrive as early as possible" priority.`;
          break;
      }
    }
  }

  return evaluatedPlans;
}

/**
 * Generates an ordered action plan for a selected recovery plan.
 * Respects prerequisites and orders known deadlines first.
 * Never invents deadlines; unknown deadlines state "Confirm deadline with provider."
 */
export function generateActionPlan(
  selectedPlan: RecoveryPlan,
  trip: Trip
): ActionItem[] {
  const actions: ActionItem[] = [];
  let stepCounter = 1;

  // Build raw action items from options in the plan
  selectedPlan.options.forEach((opt) => {
    const targetBooking = trip.bookings.find((b) => b.id === opt.targetBookingId);
    const provider = targetBooking?.provider || opt.title;

    switch (opt.type) {
      case 'alternative-transport': {
        actions.push({
          id: `act-${stepCounter++}`,
          stepNumber: 0,
          action: `Book alternative transport: ${opt.title} (${opt.description})`,
          provider,
          deadline: opt.deadline,
          deadlineType: opt.deadlineType,
          deadlineDisplay: opt.deadline
            ? formatDeadlineTime(opt.deadline)
            : 'Confirm deadline with provider.',
          prerequisiteStepIds: [],
        });
        break;
      }

      case 'local-transport': {
        const parentTransport = actions.find((a) => a.action.startsWith('Book alternative transport'));
        actions.push({
          id: `act-${stepCounter++}`,
          stepNumber: 0,
          action: `Arrange ground transit: ${opt.title} (${opt.description})`,
          provider: 'Local Transport Provider',
          deadline: opt.deadline,
          deadlineType: opt.deadlineType,
          deadlineDisplay: opt.deadline
            ? formatDeadlineTime(opt.deadline)
            : 'Confirm deadline with provider.',
          prerequisiteStepIds: parentTransport ? [parentTransport.id] : [],
        });
        break;
      }

      case 'contact-provider': {
        actions.push({
          id: `act-${stepCounter++}`,
          stepNumber: 0,
          action: `Contact accommodation provider for late check-in confirmation: ${opt.title}`,
          provider,
          deadline: opt.deadline || targetBooking?.arrivalDeadline,
          deadlineType: (opt.deadline || targetBooking?.arrivalDeadline) ? 'user-entered' : 'unknown',
          deadlineDisplay: (opt.deadline || targetBooking?.arrivalDeadline)
            ? formatDeadlineTime(opt.deadline || targetBooking!.arrivalDeadline!)
            : 'Confirm deadline with provider.',
          prerequisiteStepIds: [],
        });
        break;
      }

      case 'drop-commitment': {
        actions.push({
          id: `act-${stepCounter++}`,
          stepNumber: 0,
          action: `Cancel or release reservation: ${opt.title}`,
          provider,
          deadline: targetBooking?.cancellationDeadline,
          deadlineType: targetBooking?.cancellationDeadline ? 'user-entered' : 'unknown',
          deadlineDisplay: targetBooking?.cancellationDeadline
            ? formatDeadlineTime(targetBooking.cancellationDeadline)
            : 'Confirm deadline with provider.',
          prerequisiteStepIds: [],
        });
        break;
      }

      case 'reschedule': {
        actions.push({
          id: `act-${stepCounter++}`,
          stepNumber: 0,
          action: `Request reschedule with provider: ${opt.title}`,
          provider,
          deadline: opt.deadline || targetBooking?.cancellationDeadline,
          deadlineType: (opt.deadline || targetBooking?.cancellationDeadline) ? 'user-entered' : 'unknown',
          deadlineDisplay: (opt.deadline || targetBooking?.cancellationDeadline)
            ? formatDeadlineTime(opt.deadline || targetBooking!.cancellationDeadline!)
            : 'Confirm deadline with provider.',
          prerequisiteStepIds: [],
        });
        break;
      }
    }
  });

  // Check missed commitments that require notification or claim actions
  selectedPlan.commitments.forEach((comm) => {
    if (comm.status === 'missed') {
      const alreadyHasAction = actions.some((a) => a.provider === comm.bookingTitle);
      if (!alreadyHasAction) {
        const booking = trip.bookings.find((b) => b.id === comm.bookingId);
        actions.push({
          id: `act-${stepCounter++}`,
          stepNumber: 0,
          action: `Notify ${comm.bookingTitle} of cancellation / forfeiture and request refund/credit note`,
          provider: comm.bookingTitle,
          deadline: booking?.cancellationDeadline,
          deadlineType: booking?.cancellationDeadline ? 'user-entered' : 'unknown',
          deadlineDisplay: booking?.cancellationDeadline
            ? formatDeadlineTime(booking.cancellationDeadline)
            : 'Confirm deadline with provider.',
          prerequisiteStepIds: [],
        });
      }
    }
  });

  // Order actions:
  // 1. Respect prerequisites (topological sort)
  // 2. Among eligible items, order known deadlines first (chronologically earliest first)
  // 3. Unknown deadlines come after known deadlines with "Confirm deadline with provider."
  const ordered: ActionItem[] = [];
  const remaining = [...actions];
  const completedIds = new Set<string>();

  while (remaining.length > 0) {
    const eligible = remaining.filter((item) =>
      item.prerequisiteStepIds.every((pid) => completedIds.has(pid))
    );

    if (eligible.length === 0) {
      remaining.forEach((item) => ordered.push(item));
      break;
    }

    eligible.sort((a, b) => {
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline && !b.deadline) {
        return -1;
      }
      if (!a.deadline && b.deadline) {
        return 1;
      }
      return 0;
    });

    const next = eligible[0];
    if (!next) break;
    ordered.push(next);
    completedIds.add(next.id);
    const index = remaining.indexOf(next);
    remaining.splice(index, 1);
  }

  return ordered.map((item, idx) => ({
    ...item,
    stepNumber: idx + 1,
  }));
}

function compareArrivalTimes(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function formatDeadlineTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return 'Confirm deadline with provider.';
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Confirm deadline with provider.';
  }
}
