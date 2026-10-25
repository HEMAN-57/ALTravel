import { Trip } from '../trips/trip.types';
import { Booking } from '../bookings/booking.types';
import { BookingDependency } from './dependency.types';
import { validateDependencies } from './dependency.validation';
import {
  DisruptionInput,
  DisruptionPropagationResult,
  BookingImpact,
  ImpactStatus,
} from './disruption.types';
import { validateDisruptionInput } from './disruption.validation';

/**
 * Deterministic Disruption Propagation Engine
 * 
 * Evaluates downstream consequences across explicitly defined dependencies.
 * - Does not infer dependencies between bookings unless explicitly configured.
 * - Deterministic, timezone-independent UTC millisecond math.
 * - Preserves original Trip and Booking immutability.
 */
export function propagateDisruption(
  trip: Trip,
  disruptionInput: unknown,
  explicitDependencies?: BookingDependency[]
): DisruptionPropagationResult {
  // 1. Validate Trip and Bookings
  if (!trip || typeof trip !== 'object' || !Array.isArray(trip.bookings)) {
    return {
      success: false,
      errors: ['A valid Trip containing an array of bookings is required.'],
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

  // Map to hold revised timings: bookingId -> { startTime, endTime, isCancelled }
  const revisedTimings = new Map<
    string,
    { startTime?: string; endTime?: string; isCancelled: boolean }
  >();

  revisedTimings.set(targetBooking.id, {
    startTime: targetRevised.revisedStartTime,
    endTime: targetRevised.revisedEndTime,
    isCancelled: disruption.type === 'cancellation',
  });

  // Map of impacts: bookingId -> BookingImpact
  const impactsMap = new Map<string, BookingImpact>();

  // Set target booking impact
  if (disruption.type === 'cancellation') {
    impactsMap.set(targetBooking.id, {
      bookingId: targetBooking.id,
      status: 'affected',
      cause: 'Direct cancellation.',
      explanation: `Booking "${targetBooking.provider}" was cancelled directly.`,
      revisedStartTime: undefined,
      revisedEndTime: undefined,
    });
  } else if (disruption.delayMinutes === 0) {
    impactsMap.set(targetBooking.id, {
      bookingId: targetBooking.id,
      status: 'unaffected',
      cause: 'Zero-minute delay.',
      explanation: `Booking "${targetBooking.provider}" has a zero-minute delay; schedule remains intact.`,
      revisedStartTime: targetRevised.revisedStartTime,
      revisedEndTime: targetRevised.revisedEndTime,
    });
  } else {
    impactsMap.set(targetBooking.id, {
      bookingId: targetBooking.id,
      status: 'affected',
      cause: `Delayed by ${disruption.delayMinutes} minutes.`,
      explanation: `Booking "${targetBooking.provider}" is delayed by ${disruption.delayMinutes} minutes.`,
      revisedStartTime: targetRevised.revisedStartTime,
      revisedEndTime: targetRevised.revisedEndTime,
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
      const impact = evaluateDependencyImpact(
        currentBooking,
        currentTiming,
        currentImpact?.status || 'unaffected',
        downstreamBooking,
        dep
      );

      // If already recorded with an 'affected' status, preserve the most severe impact
      const existingImpact = impactsMap.get(downstreamBooking.id);
      if (!existingImpact || severityRank(impact.status) > severityRank(existingImpact.status)) {
        impactsMap.set(downstreamBooking.id, impact);
      }

      // If downstream is delayed or affected, update revised timing
      if (!revisedTimings.has(downstreamBooking.id)) {
        revisedTimings.set(downstreamBooking.id, {
          startTime: impact.revisedStartTime || downstreamBooking.startTime,
          endTime: impact.revisedEndTime || downstreamBooking.endTime,
          isCancelled: impact.status === 'affected' && currentTiming?.isCancelled === true,
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
      originalStartTime: targetBooking.startTime,
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
 */
function calculateTargetTiming(
  booking: Booking,
  disruption: DisruptionInput
): { revisedStartTime?: string; revisedEndTime?: string } {
  if (disruption.type === 'cancellation') {
    return { revisedStartTime: undefined, revisedEndTime: undefined };
  }

  const delayMs = disruption.delayMinutes * 60000;
  const originalStartMs = Date.parse(booking.startTime);

  const revisedStartTime = Number.isNaN(originalStartMs)
    ? undefined
    : new Date(originalStartMs + delayMs).toISOString();

  let revisedEndTime: string | undefined = undefined;

  if (disruption.revisedArrivalTime) {
    revisedEndTime = disruption.revisedArrivalTime;
  } else if (booking.endTime) {
    const originalEndMs = Date.parse(booking.endTime);
    if (!Number.isNaN(originalEndMs)) {
      revisedEndTime = new Date(originalEndMs + delayMs).toISOString();
    }
  } else {
    // If no endTime was specified, revisedEndTime is equivalent to delayed startTime
    revisedEndTime = revisedStartTime;
  }

  return { revisedStartTime, revisedEndTime };
}

/**
 * Evaluates the impact on a downstream booking given an upstream booking state and explicit dependency.
 */
function evaluateDependencyImpact(
  upstream: Booking,
  upstreamTiming: { startTime?: string; endTime?: string; isCancelled: boolean } | undefined,
  upstreamImpactStatus: ImpactStatus,
  downstream: Booking,
  dep: BookingDependency
): BookingImpact {
  // Case A: Upstream was cancelled or affected through an upstream cancellation
  if (upstreamTiming?.isCancelled || upstreamImpactStatus === 'affected' && !upstreamTiming?.endTime) {
    // Hotel Uncertainty Rule (Scenario E):
    // A hotel booking with flexible check-in and no missed arrival deadline is not automatically lost or cancelled.
    if (
      downstream.type === 'hotel' ||
      dep.relationshipType === 'arrival-to-lodging' ||
      dep.commitmentType === 'flexible'
    ) {
      return {
        bookingId: downstream.id,
        status: 'atRisk',
        cause: `Upstream feeder "${upstream.provider}" was cancelled.`,
        explanation: `Upstream transport was cancelled. Hotel check-in is delayed, but no strict cutoff establishes that the hotel booking is lost. Hotel is not automatically lost or non-refundable; traveller should contact property.`,
        evidence: {
          upstreamBookingId: upstream.id,
          downstreamBookingId: downstream.id,
          relationshipType: dep.relationshipType,
          commitmentType: dep.commitmentType,
        },
      };
    }

    // Default for hard commitments (Scenario C): Connection missed / cannot board
    return {
      bookingId: downstream.id,
      status: 'affected',
      cause: `Upstream connection "${upstream.provider}" was cancelled.`,
      explanation: `Cannot board or attend "${downstream.provider}" because preceding travel leg "${upstream.provider}" was cancelled.`,
      evidence: {
        upstreamBookingId: upstream.id,
        downstreamBookingId: downstream.id,
        relationshipType: dep.relationshipType,
        commitmentType: dep.commitmentType,
      },
    };
  }

  // Case B: Upstream was delayed
  const upstreamArrivalStr = upstreamTiming?.endTime || upstreamTiming?.startTime;
  if (!upstreamArrivalStr) {
    return {
      bookingId: downstream.id,
      status: 'unknown',
      cause: 'Incomplete upstream schedule.',
      explanation: `Cannot determine connection impact because upstream booking "${upstream.provider}" timing is missing or unknown.`,
      evidence: {
        upstreamBookingId: upstream.id,
        downstreamBookingId: downstream.id,
        missingInformation: ['upstream arrival time'],
      },
    };
  }

  const downstreamStartStr = downstream.startTime;
  if (!downstreamStartStr) {
    return {
      bookingId: downstream.id,
      status: 'unknown',
      cause: 'Incomplete downstream schedule.',
      explanation: `Cannot determine connection impact because downstream booking "${downstream.provider}" start time is missing or unknown.`,
      evidence: {
        upstreamBookingId: upstream.id,
        downstreamBookingId: downstream.id,
        missingInformation: ['downstream start time'],
      },
    };
  }

  const upstreamArrivalMs = Date.parse(upstreamArrivalStr);
  const downstreamStartMs = Date.parse(downstreamStartStr);

  if (Number.isNaN(upstreamArrivalMs) || Number.isNaN(downstreamStartMs)) {
    return {
      bookingId: downstream.id,
      status: 'unknown',
      cause: 'Invalid timestamp.',
      explanation: 'One or more timestamps could not be parsed as valid dates.',
      evidence: {
        upstreamBookingId: upstream.id,
        downstreamBookingId: downstream.id,
      },
    };
  }

  const requiredBufferMinutes = dep.requiredBufferMinutes ?? 0;
  const availableTransferMinutes = Math.floor(
    (downstreamStartMs - upstreamArrivalMs) / 60000
  );
  const bufferDeficitMinutes = Math.max(0, requiredBufferMinutes - availableTransferMinutes);

  // Hotel Uncertainty Check (Scenario E)
  if (downstream.type === 'hotel' || dep.relationshipType === 'arrival-to-lodging') {
    if (downstream.arrivalDeadline) {
      const deadlineMs = Date.parse(downstream.arrivalDeadline);
      if (!Number.isNaN(deadlineMs) && upstreamArrivalMs > deadlineMs) {
        return {
          bookingId: downstream.id,
          status: 'affected',
          cause: 'Exceeded hotel late check-in cutoff deadline.',
          explanation: `Revised arrival (${upstreamArrivalStr}) is later than the hotel's guaranteed late check-in cutoff (${downstream.arrivalDeadline}).`,
          evidence: {
            upstreamBookingId: upstream.id,
            upstreamRevisedArrival: upstreamArrivalStr,
            downstreamBookingId: downstream.id,
            downstreamArrivalDeadline: downstream.arrivalDeadline,
            relationshipType: dep.relationshipType,
          },
        };
      }
    }

    // Flexible hotel check-in
    return {
      bookingId: downstream.id,
      status: 'unaffected',
      cause: 'Flexible check-in window.',
      explanation: `Hotel check-in is flexible; delayed arrival does not cause room forfeiture or cancellation.`,
      evidence: {
        upstreamBookingId: upstream.id,
        upstreamRevisedArrival: upstreamArrivalStr,
        downstreamBookingId: downstream.id,
        downstreamScheduledStart: downstreamStartStr,
        relationshipType: dep.relationshipType,
        commitmentType: dep.commitmentType,
      },
    };
  }

  // Transport Connections & Activities (Scenarios A & B)
  if (dep.requiredBufferMinutes === undefined) {
    if (availableTransferMinutes < 0) {
      return {
        bookingId: downstream.id,
        status: 'affected',
        cause: 'Arrival occurs after departure.',
        explanation: `Upstream revised arrival (${upstreamArrivalStr}) occurs after downstream scheduled start (${downstreamStartStr}).`,
        evidence: {
          upstreamBookingId: upstream.id,
          upstreamRevisedArrival: upstreamArrivalStr,
          downstreamBookingId: downstream.id,
          downstreamScheduledStart: downstreamStartStr,
          availableTransferMinutes,
          relationshipType: dep.relationshipType,
        },
      };
    }
    return {
      bookingId: downstream.id,
      status: 'atRisk',
      cause: 'Unspecified transfer buffer.',
      explanation: `Transfer buffer was not specified. Arrival precedes departure by ${availableTransferMinutes} minutes, but feasibility is at risk without a confirmed transfer buffer.`,
      evidence: {
        upstreamBookingId: upstream.id,
        upstreamRevisedArrival: upstreamArrivalStr,
        downstreamBookingId: downstream.id,
        downstreamScheduledStart: downstreamStartStr,
        availableTransferMinutes,
        relationshipType: dep.relationshipType,
      },
    };
  }

  // Check buffer satisfaction
  if (availableTransferMinutes >= requiredBufferMinutes) {
    // Scenario A: Connection survives
    return {
      bookingId: downstream.id,
      status: 'unaffected',
      cause: 'Transfer window is sufficient.',
      explanation: `Connection remains feasible. Revised arrival leaves ${availableTransferMinutes} minutes for transfer, which satisfies the required ${requiredBufferMinutes}-minute buffer.`,
      evidence: {
        upstreamBookingId: upstream.id,
        upstreamScheduledArrival: upstream.endTime || upstream.startTime,
        upstreamRevisedArrival: upstreamArrivalStr,
        downstreamBookingId: downstream.id,
        downstreamScheduledStart: downstreamStartStr,
        requiredBufferMinutes,
        availableTransferMinutes,
        relationshipType: dep.relationshipType,
        commitmentType: dep.commitmentType,
      },
    };
  }

  // Scenario B: Connection missed
  return {
    bookingId: downstream.id,
    status: 'affected',
    cause: 'Transfer buffer violated.',
    explanation: `Connection missed. Revised arrival leaves only ${availableTransferMinutes} minutes, which is insufficient for the required ${requiredBufferMinutes}-minute transfer buffer (deficit of ${bufferDeficitMinutes} minutes).`,
    evidence: {
      upstreamBookingId: upstream.id,
      upstreamScheduledArrival: upstream.endTime || upstream.startTime,
      upstreamRevisedArrival: upstreamArrivalStr,
      downstreamBookingId: downstream.id,
      downstreamScheduledStart: downstreamStartStr,
      requiredBufferMinutes,
      availableTransferMinutes,
      bufferDeficitMinutes,
      relationshipType: dep.relationshipType,
      commitmentType: dep.commitmentType,
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
