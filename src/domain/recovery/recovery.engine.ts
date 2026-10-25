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

  // Group options into distinct actionable plans:
  // 1. Standalone alternative transport or primary options
  // 2. Pairings with local transport or support options where relevant
  const primaryOptions = candidateOptions.filter(
    (opt) => opt.type === 'alternative-transport' || opt.type === 'reschedule' || opt.type === 'drop-commitment'
  );
  const localTransportOptions = candidateOptions.filter(
    (opt) => opt.type === 'local-transport'
  );
  const supportOptions = candidateOptions.filter(
    (opt) => opt.type === 'contact-provider'
  );

  // If there are no categorized primary options, treat each candidate option as its own plan
  const planDefinitions: { name: string; description: string; options: RecoveryOption[] }[] = [];

  if (primaryOptions.length > 0) {
    primaryOptions.forEach((prim) => {
      // Find relevant local transport or support options
      const relatedLocal = localTransportOptions.find(
        (loc) => loc.targetBookingId === prim.targetBookingId || loc.targetBookingId === prim.id
      );
      const relatedSupport = supportOptions.find(
        (sup) => sup.targetBookingId === prim.targetBookingId
      );

      const optionsForPlan: RecoveryOption[] = [prim];
      if (relatedLocal) {
        optionsForPlan.push(relatedLocal);
      }
      if (relatedSupport) {
        optionsForPlan.push(relatedSupport);
      }

      planDefinitions.push({
        name: prim.title,
        description: prim.description,
        options: optionsForPlan,
      });
    });

    // Also include standalone local transport if user added one that wasn't grouped
    localTransportOptions.forEach((loc) => {
      const alreadyIncluded = planDefinitions.some((pd) =>
        pd.options.some((o) => o.id === loc.id)
      );
      if (!alreadyIncluded) {
        planDefinitions.push({
          name: loc.title,
          description: loc.description,
          options: [loc],
        });
      }
    });
  } else {
    // Treat each individual option as a candidate plan
    candidateOptions.forEach((opt) => {
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
    const options = planDef.options;

    // 1. Calculate Additional Spending (strictly out-of-pocket costs for recovery options)
    const additionalSpending = options.reduce((sum, o) => sum + (o.additionalCost || 0), 0);

    // 2. Determine estimated arrival at destination
    // Pick the latest arrival among transport options in the plan
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
        // Handled by alternative option
        return;
      }

      const experienceVal = constraints.experienceValuePerBooking?.[booking.id] ?? 0;

      // Determine if this booking is preserved or missed under this plan
      let status: 'preserved' | 'missed' | 'unaffected' = 'preserved';
      let reason = 'Schedule preserved by selected recovery option.';

      // Check if arrival is in time for booking
      if (estimatedArrival && booking.startTime) {
        const arrivalTime = new Date(estimatedArrival).getTime();
        const bookingStart = new Date(booking.startTime).getTime();
        const bookingCutoff = booking.arrivalDeadline ? new Date(booking.arrivalDeadline).getTime() : bookingStart;

        // Check if there is an explicit dependency buffer
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
      }

      // Check if any option explicitly drops or reschedules this booking
      const dropOpt = options.find((o) => o.targetBookingId === booking.id && o.type === 'drop-commitment');
      if (dropOpt) {
        status = 'missed';
        reason = `Commitment dropped per plan option: ${dropOpt.title}.`;
      }

      // Check hotel specific arrival
      if (booking.type === 'hotel') {
        const hotelContactOpt = options.find((o) => o.targetBookingId === booking.id && o.type === 'contact-provider');
        if (estimatedArrival && booking.arrivalDeadline) {
          if (new Date(estimatedArrival) <= new Date(booking.arrivalDeadline)) {
            status = 'preserved';
            reason = hotelContactOpt
              ? 'Late check-in requested and arrival is within recorded hotel cutoff window.'
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

      if (status === 'missed') {
        // Non-refundable cash loss calculation (strictly separate from extra spending)
        const isNonRefundable = isBookingNonRefundable(booking);
        if (isNonRefundable) {
          nonRefundableCashLoss += booking.cost;
        }
        // Experience value lost (strictly separate subjective metric, NEVER added to currency)
        experienceValueLost += experienceVal;

        commitments.push({
          bookingId: booking.id,
          bookingTitle: booking.provider,
          bookingType: booking.type,
          status: 'missed',
          reason,
          originalCost: booking.cost,
          isNonRefundable,
          lostExperienceValue: experienceVal,
        });
      } else {
        commitments.push({
          bookingId: booking.id,
          bookingTitle: booking.provider,
          bookingType: booking.type,
          status: 'preserved',
          reason,
          originalCost: booking.cost,
          isNonRefundable: false,
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
        `Exceeds maximum recovery budget of ${constraints.maxBudget} ${currency} (Requires ${additionalSpending} ${currency}).`
      );
    }

    // Hard constraint: Non-negotiable critical booking preserved
    if (constraints.criticalBookingIds && constraints.criticalBookingIds.length > 0) {
      for (const criticalId of constraints.criticalBookingIds) {
        const missedCrit = commitments.find((c) => c.bookingId === criticalId && c.status === 'missed');
        if (missedCrit) {
          isFeasible = false;
          infeasibilityReasons.push(
            `Fails to preserve non-negotiable commitment "${missedCrit.bookingTitle}" (${missedCrit.reason}).`
          );
        }
      }
    }

    // Local transport note
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
        const aPreserved = a.commitments.filter((c) => c.status === 'preserved' || c.status === 'unaffected').length;
        const bPreserved = b.commitments.filter((c) => c.status === 'preserved' || c.status === 'unaffected').length;
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
        'No fully feasible plan found satisfying all hard constraints. Presented as the best available fallback option.';
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
          stepNumber: 0, // will assign after sorting
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
        // Local transport typically depends on having transport booked
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
    // Find items whose prerequisites are satisfied
    const eligible = remaining.filter((item) =>
      item.prerequisiteStepIds.every((pid) => completedIds.has(pid))
    );

    if (eligible.length === 0) {
      // Break cycle if any malformed prerequisites exist
      remaining.forEach((item) => ordered.push(item));
      break;
    }

    // Sort eligible: known deadlines first (chronological), then unknown
    eligible.sort((a, b) => {
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (a.deadline && !b.deadline) {
        return -1; // known deadline first
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

  // Assign sequential step numbers 1..N
  return ordered.map((item, idx) => ({
    ...item,
    stepNumber: idx + 1,
  }));
}

/**
 * Determines whether a booking's cancellation policy indicates non-refundable loss.
 */
function isBookingNonRefundable(booking: Booking): boolean {
  if (!booking.cost || booking.cost <= 0) return false;
  if (!booking.cancellationPolicyNotes) return true; // Assume non-refundable unless stated otherwise

  const notes = booking.cancellationPolicyNotes.toLowerCase();
  if (notes.includes('non-refundable') || notes.includes('retained') || notes.includes('forfeited')) {
    return true;
  }
  if (notes.includes('100% refund') || notes.includes('free cancellation')) {
    // If cancellation deadline is specified and in the past, it is non-refundable
    if (booking.cancellationDeadline) {
      return new Date(booking.cancellationDeadline).getTime() < Date.now();
    }
    return false;
  }
  return true;
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
