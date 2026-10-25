import { Trip } from '../trips/trip.types';
import { Booking } from '../bookings/booking.types';
import { isValidDateString } from '../bookings/booking.validation';
import { BookingDependency } from './dependency.types';
import { validateDependencies } from './dependency.validation';
import {
  DisruptionInput,
  DisruptionPropagationResult,
  BookingImpact,
  ImpactStatus,
} from './disruption.types';
import { validateDisruptionInput } from './disruption.validation';

interface BookingTimingState {
  originalStartTime?: string;
  originalEndTime?: string;
  revisedStartTime?: string;
  revisedEndTime?: string;
  isDisrupted: boolean;
  isCancelled: boolean;
  scheduleChanged: boolean;
}

/**
 * Deterministic Disruption Propagation Engine
 * 
 * Evaluates downstream consequences across explicitly defined dependencies.
 * - Does not infer dependencies between bookings unless explicitly configured.
 * - Deterministic, timezone-independent UTC millisecond math.
 * - Preserves original Trip and Booking immutability.
 * - Distinguishes feasible unchanged schedules from missed connections and revised arrivals.
 * - Handles incomplete and unverified timing honestly without fake fallbacks.
 */
export function propagateDisruption(
  trip: Trip,
  disruptionInput: unknown,
  explicitDependencies?: BookingDependency[]
): DisruptionPropagationResult {
  // 1. Validate Trip and Bookings structure
  if (!trip || typeof trip !== 'object' || !Array.isArray(trip.bookings)) {
    return {
      success: false,
      errors: ['A valid Trip containing an array of bookings is required.'],
      impacts: [],
      summary: createEmptySummary(),
    };
  }

  // 1b. Validate bookings timestamps (invalid date strings are validation errors)
  const tripValidationErrors: string[] = [];
  for (let i = 0; i < trip.bookings.length; i++) {
    const booking = trip.bookings[i];
    if (!booking || typeof booking !== 'object') {
      tripValidationErrors.push(`Booking #${i + 1} must be a non-null object.`);
      continue;
    }
    const bId = booking.id || `#${i + 1}`;

    // startTime validation (if provided, must be a valid non-empty date string; undefined is preserved for unscheduled bookings)
    if (booking.startTime !== undefined) {
      if (typeof booking.startTime !== 'string' || !isValidDateString(booking.startTime)) {
        tripValidationErrors.push(`Booking "${bId}" has invalid startTime: "${String(booking.startTime)}". Empty strings are not permitted; use undefined for unscheduled bookings.`);
      }
    }

    // endTime validation (if provided, must be a valid non-empty date string)
    if (booking.endTime !== undefined && booking.endTime !== null) {
      if (typeof booking.endTime !== 'string' || !isValidDateString(booking.endTime)) {
        tripValidationErrors.push(`Booking "${bId}" has invalid endTime: "${String(booking.endTime)}".`);
      }
    }

    // arrivalDeadline validation
    if (booking.arrivalDeadline !== undefined && booking.arrivalDeadline !== null) {
      if (typeof booking.arrivalDeadline !== 'string' || !isValidDateString(booking.arrivalDeadline)) {
        tripValidationErrors.push(`Booking "${bId}" has invalid arrivalDeadline: "${String(booking.arrivalDeadline)}".`);
      }
    }

    // cancellationDeadline validation
    if (booking.cancellationDeadline !== undefined && booking.cancellationDeadline !== null) {
      if (typeof booking.cancellationDeadline !== 'string' || !isValidDateString(booking.cancellationDeadline)) {
        tripValidationErrors.push(`Booking "${bId}" has invalid cancellationDeadline: "${String(booking.cancellationDeadline)}".`);
      }
    }
  }

  if (tripValidationErrors.length > 0) {
    return {
      success: false,
      errors: tripValidationErrors,
      impacts: [],
      summary: createEmptySummary(),
    };
  }

  // 2. Validate Disruption Input
  const disruptionVal = validateDisruptionInput(disruptionInput, trip);
  if (!disruptionVal.success || !disruptionVal.data) {
    return {
      success: false,
      errors: disruptionVal.errors,
      impacts: [],
      summary: createEmptySummary(),
    };
  }
  const disruption = disruptionVal.data;

  // 3. Resolve and Validate Dependencies
  const dependenciesToValidate = explicitDependencies ?? trip.dependencies ?? [];
  const depVal = validateDependencies(dependenciesToValidate, trip.bookings);
  if (!depVal.success || !depVal.data) {
    return {
      success: false,
      errors: depVal.errors,
      impacts: [],
      summary: createEmptySummary(),
    };
  }
  const dependencies = depVal.data;

  // 4. Index Bookings and Build Adjacency Graph
  const bookingMap = new Map<string, Booking>(trip.bookings.map((b) => [b.id, b]));
  const targetBooking = bookingMap.get(disruption.targetBookingId);

  if (!targetBooking) {
    return {
      success: false,
      errors: [`Target booking "${disruption.targetBookingId}" not found in trip.`],
      impacts: [],
      summary: createEmptySummary(),
    };
  }

  // Outgoing dependencies by upstream booking ID
  const outgoingDeps = new Map<string, BookingDependency[]>();
  for (const dep of dependencies) {
    const list = outgoingDeps.get(dep.upstreamBookingId) || [];
    list.push(dep);
    outgoingDeps.set(dep.upstreamBookingId, list);
  }

  // 5. Calculate Target Booking Revised Timing
  const targetRevised = calculateTargetTiming(targetBooking, disruption);

  // Map to hold revised timing state: bookingId -> BookingTimingState
  const revisedTimings = new Map<string, BookingTimingState>();

  // Map of impacts: bookingId -> BookingImpact
  const impactsMap = new Map<string, BookingImpact>();

  // Set target booking impact and timing state
  if (disruption.type === 'cancellation') {
    revisedTimings.set(targetBooking.id, {
      originalStartTime: targetBooking.startTime,
      originalEndTime: targetBooking.endTime,
      revisedStartTime: undefined,
      revisedEndTime: undefined,
      isDisrupted: true,
      isCancelled: true,
      scheduleChanged: true,
    });
    impactsMap.set(targetBooking.id, {
      bookingId: targetBooking.id,
      status: 'affected',
      cause: 'Direct cancellation.',
      explanation: `Booking "${targetBooking.provider}" was cancelled directly.`,
      originalStartTime: targetBooking.startTime,
      originalEndTime: targetBooking.endTime,
      revisedStartTime: undefined,
      revisedEndTime: undefined,
      scheduleChanged: true,
    });
  } else if (disruption.delayMinutes === 0) {
    revisedTimings.set(targetBooking.id, {
      originalStartTime: targetBooking.startTime,
      originalEndTime: targetBooking.endTime,
      revisedStartTime: targetBooking.startTime,
      revisedEndTime: targetBooking.endTime,
      isDisrupted: false,
      isCancelled: false,
      scheduleChanged: false,
    });
    impactsMap.set(targetBooking.id, {
      bookingId: targetBooking.id,
      status: 'unaffected',
      cause: 'Zero-minute delay.',
      explanation: `Booking "${targetBooking.provider}" has a zero-minute delay; schedule remains intact.`,
      originalStartTime: targetBooking.startTime,
      originalEndTime: targetBooking.endTime,
      revisedStartTime: targetBooking.startTime,
      revisedEndTime: targetBooking.endTime,
      scheduleChanged: false,
    });
  } else {
    revisedTimings.set(targetBooking.id, {
      originalStartTime: targetBooking.startTime,
      originalEndTime: targetBooking.endTime,
      revisedStartTime: targetRevised.revisedStartTime,
      revisedEndTime: targetRevised.revisedEndTime,
      isDisrupted: false,
      isCancelled: false,
      scheduleChanged: true,
    });
    impactsMap.set(targetBooking.id, {
      bookingId: targetBooking.id,
      status: 'affected',
      cause: `Delayed by ${disruption.delayMinutes} minutes.`,
      explanation: `Booking "${targetBooking.provider}" is delayed by ${disruption.delayMinutes} minutes.`,
      originalStartTime: targetBooking.startTime,
      originalEndTime: targetBooking.endTime,
      revisedStartTime: targetRevised.revisedStartTime,
      revisedEndTime: targetRevised.revisedEndTime,
      scheduleChanged: true,
    });
  }

  // 6. Propagate Downstream Consequences via BFS Queue
  const queue: string[] = [targetBooking.id];
  const reachableFromDisruption = new Set<string>([targetBooking.id]);

  while (queue.length > 0) {
    const currentBookingId = queue.shift()!;
    const currentTiming = revisedTimings.get(currentBookingId);
    const currentImpact = impactsMap.get(currentBookingId);
    const currentBooking = bookingMap.get(currentBookingId);

    if (!currentBooking) continue;

    const downstreamDeps = outgoingDeps.get(currentBookingId) || [];

    for (const dep of downstreamDeps) {
      const downstreamBooking = bookingMap.get(dep.downstreamBookingId);
      if (!downstreamBooking) continue;

      reachableFromDisruption.add(downstreamBooking.id);

      // Evaluate the downstream booking's impact based on current booking state
      const { impact, timingState } = evaluateDependencyImpact(
        currentBooking,
        currentTiming,
        currentImpact?.status || 'unaffected',
        downstreamBooking,
        dep
      );

      // If already recorded with an impact status, preserve the most severe impact
      const existingImpact = impactsMap.get(downstreamBooking.id);
      if (!existingImpact || severityRank(impact.status) > severityRank(existingImpact.status)) {
        impactsMap.set(downstreamBooking.id, impact);
      }

      // Update timing state for downstream booking
      const existingTiming = revisedTimings.get(downstreamBooking.id);
      if (!existingTiming) {
        revisedTimings.set(downstreamBooking.id, timingState);
      } else {
        // If downstream was marked disrupted by any upstream dependency, preserve the disrupted state
        const isDisrupted = existingTiming.isDisrupted || timingState.isDisrupted;
        const isCancelled = existingTiming.isCancelled || timingState.isCancelled;
        const scheduleChanged = existingTiming.scheduleChanged || timingState.scheduleChanged;

        revisedTimings.set(downstreamBooking.id, {
          originalStartTime: downstreamBooking.startTime,
          originalEndTime: downstreamBooking.endTime,
          revisedStartTime: isDisrupted ? undefined : (timingState.revisedStartTime ?? existingTiming.revisedStartTime),
          revisedEndTime: isDisrupted ? undefined : (timingState.revisedEndTime ?? existingTiming.revisedEndTime),
          isDisrupted,
          isCancelled,
          scheduleChanged,
        });
      }

      queue.push(downstreamBooking.id);
    }
  }

  // 7. Process Unrelated Bookings (Scenario D)
  // Bookings with no directed dependency path from the disrupted booking must NOT be marked affected.
  for (const booking of trip.bookings) {
    if (!reachableFromDisruption.has(booking.id)) {
      impactsMap.set(booking.id, {
        bookingId: booking.id,
        status: 'unaffected',
        cause: 'No dependency path.',
        explanation: `Booking "${booking.provider}" has no explicit dependency path from disrupted booking "${targetBooking.provider}".`,
        originalStartTime: booking.startTime,
        originalEndTime: booking.endTime,
        revisedStartTime: booking.startTime,
        revisedEndTime: booking.endTime,
        scheduleChanged: false,
      });
    }
  }

  // Convert map to list matching trip booking order
  const impactsList: BookingImpact[] = trip.bookings.map(
    (b) => impactsMap.get(b.id) || {
      bookingId: b.id,
      status: 'unaffected',
      cause: 'No dependency path.',
      explanation: 'No dependency path from disrupted booking.',
      originalStartTime: b.startTime,
      originalEndTime: b.endTime,
      revisedStartTime: b.startTime,
      revisedEndTime: b.endTime,
      scheduleChanged: false,
    }
  );

  // 8. Tally Summary
  const summary = {
    totalBookingsEvaluated: trip.bookings.length,
    totalAffected: impactsList.filter((i) => i.status === 'affected').length,
    totalAtRisk: impactsList.filter((i) => i.status === 'atRisk').length,
    totalUnaffected: impactsList.filter((i) => i.status === 'unaffected').length,
    totalUnknown: impactsList.filter((i) => i.status === 'unknown').length,
  };

  return {
    success: true,
    disruptedBookingId: targetBooking.id,
    disruptionType: disruption.type,
    targetDisruption: {
      bookingId: targetBooking.id,
      type: disruption.type,
      delayMinutes: disruption.type === 'delay' ? disruption.delayMinutes : undefined,
      originalStartTime: targetBooking.startTime || '',
      originalEndTime: targetBooking.endTime,
      revisedStartTime: targetRevised.revisedStartTime,
      revisedEndTime: targetRevised.revisedEndTime,
    },
    impacts: impactsList,
    summary,
  };
}

/**
 * Calculates revised start and end time for the directly disrupted booking.
 * Does not invent an arrival time if none is specified or derivable.
 */
function calculateTargetTiming(
  booking: Booking,
  disruption: DisruptionInput
): { revisedStartTime?: string; revisedEndTime?: string } {
  if (disruption.type === 'cancellation') {
    return { revisedStartTime: undefined, revisedEndTime: undefined };
  }

  const delayMs = disruption.delayMinutes * 60000;
  let revisedStartTime: string | undefined = undefined;
  if (booking.startTime) {
    const originalStartMs = Date.parse(booking.startTime);
    if (!Number.isNaN(originalStartMs)) {
      revisedStartTime = new Date(originalStartMs + delayMs).toISOString();
    }
  }

  let revisedEndTime: string | undefined = undefined;
  if (disruption.revisedArrivalTime) {
    revisedEndTime = disruption.revisedArrivalTime;
  } else if (booking.endTime) {
    const originalEndMs = Date.parse(booking.endTime);
    if (!Number.isNaN(originalEndMs)) {
      revisedEndTime = new Date(originalEndMs + delayMs).toISOString();
    }
  }
  // When no endTime is present and no revisedArrivalTime was supplied,
  // revisedEndTime remains undefined (honest incomplete timing).

  return { revisedStartTime, revisedEndTime };
}

/**
 * Evaluates the impact and timing state on a downstream booking given an upstream booking state and explicit dependency.
 */
function evaluateDependencyImpact(
  upstream: Booking,
  upstreamTiming: BookingTimingState | undefined,
  _upstreamImpactStatus: ImpactStatus,
  downstream: Booking,
  dep: BookingDependency
): { impact: BookingImpact; timingState: BookingTimingState } {
  // Case A: Upstream was cancelled
  if (upstreamTiming?.isCancelled) {
    // Hotel Uncertainty Rule:
    // A hotel booking with flexible check-in and no missed arrival deadline is not automatically lost or cancelled.
    if (
      downstream.type === 'hotel' ||
      dep.relationshipType === 'arrival-to-lodging' ||
      dep.commitmentType === 'flexible'
    ) {
      return {
        impact: {
          bookingId: downstream.id,
          status: 'atRisk',
          cause: `Upstream feeder "${upstream.provider}" was cancelled.`,
          explanation: `Upstream transport was cancelled. Hotel check-in is delayed, but no strict cutoff establishes that the hotel booking is lost. Hotel is not automatically lost or non-refundable; traveller should contact property.`,
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: undefined,
          revisedEndTime: undefined,
          scheduleChanged: true,
          evidence: {
            upstreamBookingId: upstream.id,
            downstreamBookingId: downstream.id,
            relationshipType: dep.relationshipType,
            commitmentType: dep.commitmentType,
          },
        },
        timingState: {
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: undefined,
          revisedEndTime: undefined,
          isDisrupted: true,
          isCancelled: false,
          scheduleChanged: true,
        },
      };
    }

    // Default for hard commitments / transport: Connection missed / cannot board
    return {
      impact: {
        bookingId: downstream.id,
        status: 'affected',
        cause: `Upstream connection "${upstream.provider}" was cancelled.`,
        explanation: `Cannot board or attend "${downstream.provider}" because preceding travel leg "${upstream.provider}" was cancelled.`,
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        scheduleChanged: true,
        evidence: {
          upstreamBookingId: upstream.id,
          downstreamBookingId: downstream.id,
          relationshipType: dep.relationshipType,
          commitmentType: dep.commitmentType,
        },
      },
      timingState: {
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        isDisrupted: true,
        isCancelled: true,
        scheduleChanged: true,
      },
    };
  }

  // Case B: Upstream connection was missed / disrupted
  if (upstreamTiming?.isDisrupted) {
    if (
      downstream.type === 'hotel' ||
      dep.relationshipType === 'arrival-to-lodging' ||
      dep.commitmentType === 'flexible'
    ) {
      return {
        impact: {
          bookingId: downstream.id,
          status: 'atRisk',
          cause: `Preceding connection was missed.`,
          explanation: `Preceding travel connection "${upstream.provider}" was missed. Check-in is at risk, but no strict cutoff establishes that the hotel booking is lost. Hotel is not automatically lost or non-refundable; traveller should contact property.`,
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: undefined,
          revisedEndTime: undefined,
          scheduleChanged: true,
          evidence: {
            upstreamBookingId: upstream.id,
            downstreamBookingId: downstream.id,
            relationshipType: dep.relationshipType,
            commitmentType: dep.commitmentType,
          },
        },
        timingState: {
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: undefined,
          revisedEndTime: undefined,
          isDisrupted: true,
          isCancelled: false,
          scheduleChanged: true,
        },
      };
    }

    return {
      impact: {
        bookingId: downstream.id,
        status: 'affected',
        cause: `Preceding connection was missed.`,
        explanation: `Cannot board or attend "${downstream.provider}" because preceding travel connection "${upstream.provider}" was missed due to upstream disruption.`,
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        scheduleChanged: true,
        evidence: {
          upstreamBookingId: upstream.id,
          downstreamBookingId: downstream.id,
          relationshipType: dep.relationshipType,
          commitmentType: dep.commitmentType,
        },
      },
      timingState: {
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        isDisrupted: true,
        isCancelled: false,
        scheduleChanged: true,
      },
    };
  }

  // Case C: Incomplete upstream arrival timing
  // We strictly require an arrival time (revised or scheduled). No fake fallback to startTime.
  const upstreamArrivalStr = upstreamTiming?.revisedEndTime ?? upstream.endTime;
  if (!upstreamArrivalStr) {
    return {
      impact: {
        bookingId: downstream.id,
        status: 'unknown',
        cause: 'Incomplete upstream schedule.',
        explanation: `Cannot determine connection impact because upstream booking "${upstream.provider}" arrival time is missing or unknown.`,
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        scheduleChanged: false,
        evidence: {
          upstreamBookingId: upstream.id,
          downstreamBookingId: downstream.id,
          missingInformation: ['upstream arrival time'],
        },
      },
      timingState: {
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        isDisrupted: false,
        isCancelled: false,
        scheduleChanged: false,
      },
    };
  }

  // Case D: Incomplete downstream start timing
  const downstreamStartStr = downstream.startTime;
  if (!downstreamStartStr) {
    return {
      impact: {
        bookingId: downstream.id,
        status: 'unknown',
        cause: 'Incomplete downstream schedule.',
        explanation: `Cannot determine connection impact because downstream booking "${downstream.provider}" start time is missing or unknown.`,
        originalStartTime: undefined,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        scheduleChanged: false,
        evidence: {
          upstreamBookingId: upstream.id,
          downstreamBookingId: downstream.id,
          missingInformation: ['downstream start time'],
        },
      },
      timingState: {
        originalStartTime: undefined,
        originalEndTime: downstream.endTime,
        revisedStartTime: undefined,
        revisedEndTime: undefined,
        isDisrupted: false,
        isCancelled: false,
        scheduleChanged: false,
      },
    };
  }

  const upstreamArrivalMs = Date.parse(upstreamArrivalStr);
  const downstreamStartMs = Date.parse(downstreamStartStr);
  const availableTransferMinutes = Math.floor((downstreamStartMs - upstreamArrivalMs) / 60000);

  // Case E: Hotel / Lodging Uncertainty-Aware Evaluation
  if (downstream.type === 'hotel' || dep.relationshipType === 'arrival-to-lodging') {
    if (downstream.arrivalDeadline) {
      const deadlineMs = Date.parse(downstream.arrivalDeadline);
      if (!Number.isNaN(deadlineMs) && upstreamArrivalMs > deadlineMs) {
        return {
          impact: {
            bookingId: downstream.id,
            status: 'affected',
            cause: 'Exceeded hotel late check-in cutoff deadline.',
            explanation: `Revised arrival (${upstreamArrivalStr}) exceeds the hotel's confirmed check-in cutoff (${downstream.arrivalDeadline}).`,
            originalStartTime: downstream.startTime,
            originalEndTime: downstream.endTime,
            revisedStartTime: upstreamArrivalStr,
            revisedEndTime: downstream.endTime,
            scheduleChanged: true,
            evidence: {
              upstreamBookingId: upstream.id,
              upstreamRevisedArrival: upstreamArrivalStr,
              downstreamBookingId: downstream.id,
              downstreamArrivalDeadline: downstream.arrivalDeadline,
              relationshipType: dep.relationshipType,
              commitmentType: dep.commitmentType,
            },
          },
          timingState: {
            originalStartTime: downstream.startTime,
            originalEndTime: downstream.endTime,
            revisedStartTime: upstreamArrivalStr,
            revisedEndTime: downstream.endTime,
            isDisrupted: true,
            isCancelled: false,
            scheduleChanged: true,
          },
        };
      }

      // Arrival is within the recorded cutoff window
      return {
        impact: {
          bookingId: downstream.id,
          status: 'unaffected',
          cause: 'Arrival precedes recorded check-in cutoff.',
          explanation: `Arrival (${upstreamArrivalStr}) is within the recorded check-in cutoff (${downstream.arrivalDeadline}), but the provider's actual policy and reservation status are not independently verified.`,
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: downstream.startTime,
          revisedEndTime: downstream.endTime,
          scheduleChanged: false,
          evidence: {
            upstreamBookingId: upstream.id,
            upstreamRevisedArrival: upstreamArrivalStr,
            downstreamBookingId: downstream.id,
            downstreamArrivalDeadline: downstream.arrivalDeadline,
            relationshipType: dep.relationshipType,
            commitmentType: dep.commitmentType,
          },
        },
        timingState: {
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: downstream.startTime,
          revisedEndTime: downstream.endTime,
          isDisrupted: false,
          isCancelled: false,
          scheduleChanged: false,
        },
      };
    }

    // Cutoff is unverified / absent
    // Determine whether upstream arrival is actually delayed compared to scheduled arrival
    const scheduledArrivalMs = upstream.endTime
      ? Date.parse(upstream.endTime)
      : (upstream.startTime ? Date.parse(upstream.startTime) : upstreamArrivalMs);
    const isDelayedArrival = upstreamArrivalMs > scheduledArrivalMs;

    if (isDelayedArrival) {
      return {
        impact: {
          bookingId: downstream.id,
          status: 'atRisk',
          cause: 'Unverified check-in cutoff.',
          explanation: `There is no evidence that the reservation is lost, but the property's check-in cutoff is unverified. Delayed arrival may impact check-in; traveller should contact property to confirm late arrival.`,
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: upstreamArrivalStr,
          revisedEndTime: downstream.endTime,
          scheduleChanged: true,
          evidence: {
            upstreamBookingId: upstream.id,
            upstreamRevisedArrival: upstreamArrivalStr,
            downstreamBookingId: downstream.id,
            downstreamScheduledStart: downstreamStartStr,
            relationshipType: dep.relationshipType,
            commitmentType: dep.commitmentType,
            missingInformation: ['hotel arrival deadline / check-in cutoff'],
          },
        },
        timingState: {
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: upstreamArrivalStr,
          revisedEndTime: downstream.endTime,
          isDisrupted: false,
          isCancelled: false,
          scheduleChanged: true,
        },
      };
    }

    // Scheduled on-time arrival without delay
    return {
      impact: {
        bookingId: downstream.id,
        status: 'unaffected',
        cause: dep.commitmentType === 'flexible' ? 'Flexible check-in window.' : 'Scheduled on-time arrival.',
        explanation: dep.commitmentType === 'flexible'
          ? `Arrival is on schedule and within the recorded flexible check-in window, but provider policies and reservation status are not independently verified.`
          : `Arrival is on schedule and within the recorded window, but provider policies and reservation status are not independently verified.`,
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: downstream.startTime,
        revisedEndTime: downstream.endTime,
        scheduleChanged: false,
        evidence: {
          upstreamBookingId: upstream.id,
          upstreamRevisedArrival: upstreamArrivalStr,
          downstreamBookingId: downstream.id,
          downstreamScheduledStart: downstreamStartStr,
          relationshipType: dep.relationshipType,
          commitmentType: dep.commitmentType,
        },
      },
      timingState: {
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: downstream.startTime,
        revisedEndTime: downstream.endTime,
        isDisrupted: false,
        isCancelled: false,
        scheduleChanged: false,
      },
    };
  }

  // Case F: Transport Connections & Activities
  // If buffer is unspecified
  if (dep.requiredBufferMinutes === undefined) {
    if (availableTransferMinutes < 0) {
      return {
        impact: {
          bookingId: downstream.id,
          status: 'affected',
          cause: 'Arrival occurs after departure.',
          explanation: `Upstream revised arrival (${upstreamArrivalStr}) occurs after downstream scheduled start (${downstreamStartStr}).`,
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: undefined,
          revisedEndTime: undefined,
          scheduleChanged: true,
          evidence: {
            upstreamBookingId: upstream.id,
            upstreamRevisedArrival: upstreamArrivalStr,
            downstreamBookingId: downstream.id,
            downstreamScheduledStart: downstreamStartStr,
            availableTransferMinutes,
            relationshipType: dep.relationshipType,
            commitmentType: dep.commitmentType,
          },
        },
        timingState: {
          originalStartTime: downstream.startTime,
          originalEndTime: downstream.endTime,
          revisedStartTime: undefined,
          revisedEndTime: undefined,
          isDisrupted: true,
          isCancelled: false,
          scheduleChanged: true,
        },
      };
    }

    return {
      impact: {
        bookingId: downstream.id,
        status: 'atRisk',
        cause: 'Unspecified transfer buffer.',
        explanation: `Transfer buffer was not specified. Arrival precedes departure by ${availableTransferMinutes} minutes, but feasibility is at risk without a confirmed transfer buffer.`,
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: downstream.startTime,
        revisedEndTime: downstream.endTime,
        scheduleChanged: false,
        evidence: {
          upstreamBookingId: upstream.id,
          upstreamRevisedArrival: upstreamArrivalStr,
          downstreamBookingId: downstream.id,
          downstreamScheduledStart: downstreamStartStr,
          availableTransferMinutes,
          relationshipType: dep.relationshipType,
          commitmentType: dep.commitmentType,
          missingInformation: ['required transfer buffer'],
        },
      },
      timingState: {
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: downstream.startTime,
        revisedEndTime: downstream.endTime,
        isDisrupted: false,
        isCancelled: false,
        scheduleChanged: false,
      },
    };
  }

  // If buffer is specified
  const requiredBufferMinutes = dep.requiredBufferMinutes;
  const bufferDeficitMinutes = Math.max(0, requiredBufferMinutes - availableTransferMinutes);

  if (availableTransferMinutes >= requiredBufferMinutes) {
    // Connection survives (Scenario A):
    // For fixed scheduled transport (flight / train) or fixed activity, scheduled timing remains intact.
    // It is marked unaffected and its schedule is NOT shifted.
    return {
      impact: {
        bookingId: downstream.id,
        status: 'unaffected',
        cause: 'Transfer window is sufficient.',
        explanation: `Connection remains feasible. Revised arrival leaves ${availableTransferMinutes} minutes for transfer, which satisfies the required ${requiredBufferMinutes}-minute buffer.`,
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: downstream.startTime,
        revisedEndTime: downstream.endTime,
        scheduleChanged: false,
        evidence: {
          upstreamBookingId: upstream.id,
          upstreamScheduledArrival: upstream.endTime,
          upstreamRevisedArrival: upstreamArrivalStr,
          downstreamBookingId: downstream.id,
          downstreamScheduledStart: downstreamStartStr,
          requiredBufferMinutes,
          availableTransferMinutes,
          relationshipType: dep.relationshipType,
          commitmentType: dep.commitmentType,
        },
      },
      timingState: {
        originalStartTime: downstream.startTime,
        originalEndTime: downstream.endTime,
        revisedStartTime: downstream.startTime,
        revisedEndTime: downstream.endTime,
        isDisrupted: false,
        isCancelled: false,
        scheduleChanged: false,
      },
    };
  }

  // Connection missed (Scenario B):
  // The transfer buffer was violated. Passenger misses the downstream connection.
  // Revised times are undefined because the passenger cannot board this booking.
  return {
    impact: {
      bookingId: downstream.id,
      status: 'affected',
      cause: 'Transfer buffer violated.',
      explanation: `Connection missed. Revised arrival leaves only ${availableTransferMinutes} minutes, which is insufficient for the required ${requiredBufferMinutes}-minute transfer buffer (deficit of ${bufferDeficitMinutes} minutes).`,
      originalStartTime: downstream.startTime,
      originalEndTime: downstream.endTime,
      revisedStartTime: undefined,
      revisedEndTime: undefined,
      scheduleChanged: true,
      evidence: {
        upstreamBookingId: upstream.id,
        upstreamScheduledArrival: upstream.endTime,
        upstreamRevisedArrival: upstreamArrivalStr,
        downstreamBookingId: downstream.id,
        downstreamScheduledStart: downstreamStartStr,
        requiredBufferMinutes,
        availableTransferMinutes,
        bufferDeficitMinutes,
        relationshipType: dep.relationshipType,
        commitmentType: dep.commitmentType,
      },
    },
    timingState: {
      originalStartTime: downstream.startTime,
      originalEndTime: downstream.endTime,
      revisedStartTime: undefined,
      revisedEndTime: undefined,
      isDisrupted: true,
      isCancelled: false,
      scheduleChanged: true,
    },
  };
}

function severityRank(status: ImpactStatus): number {
  switch (status) {
    case 'affected':
      return 4;
    case 'atRisk':
      return 3;
    case 'unknown':
      return 2;
    case 'unaffected':
      return 1;
  }
}

function createEmptySummary() {
  return {
    totalBookingsEvaluated: 0,
    totalAffected: 0,
    totalAtRisk: 0,
    totalUnaffected: 0,
    totalUnknown: 0,
  };
}
