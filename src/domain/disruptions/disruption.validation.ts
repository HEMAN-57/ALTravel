import { Trip } from '../trips/trip.types';
import { Booking } from '../bookings/booking.types';
import { DisruptionInput, DisruptionType } from './disruption.types';
import { isValidDateString } from '../bookings/booking.validation';

export interface DisruptionValidationResult {
  success: boolean;
  errors: string[];
  data?: DisruptionInput;
}

export function validateDisruptionInput(
  input: unknown,
  trip: Trip
): DisruptionValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { success: false, errors: ['Disruption input must be a non-null object.'] };
  }

  const candidate = input as Record<string, unknown>;

  // targetBookingId
  let targetBooking: Booking | undefined = undefined;
  if (
    typeof candidate.targetBookingId !== 'string' ||
    candidate.targetBookingId.trim() === ''
  ) {
    errors.push('Target booking ID is required.');
  } else {
    targetBooking = trip.bookings.find((b) => b.id === candidate.targetBookingId);
    if (!targetBooking) {
      errors.push(
        `Disrupted booking ID "${candidate.targetBookingId}" does not exist in trip "${trip.name}" (${trip.id}).`
      );
    }
  }

  // type
  const type = candidate.type as DisruptionType;
  if (type !== 'delay' && type !== 'cancellation') {
    errors.push('Disruption type must be either "delay" or "cancellation".');
  }

  // Delay specific requirements
  if (type === 'delay') {
    const delay = candidate.delayMinutes;
    if (
      typeof delay !== 'number' ||
      !Number.isFinite(delay) ||
      !Number.isInteger(delay) ||
      delay < 0
    ) {
      errors.push(
        `Delay duration must be a non-negative number of minutes. Must be a finite integer (received: ${String(delay)}).`
      );
    }

    if (
      candidate.revisedArrivalTime !== undefined &&
      candidate.revisedArrivalTime !== null
    ) {
      if (
        typeof candidate.revisedArrivalTime !== 'string' ||
        !isValidDateString(candidate.revisedArrivalTime)
      ) {
        errors.push('Revised arrival time, if supplied, must be a valid ISO date/time string.');
      } else if (
        typeof delay === 'number' &&
        Number.isFinite(delay) &&
        Number.isInteger(delay) &&
        delay >= 0 &&
        targetBooking
      ) {
        // Contradiction check: if scheduled arrival exists, reported revised arrival must align with delay
        const reportedRevisedMs = Date.parse(candidate.revisedArrivalTime);
        if (targetBooking.endTime) {
          const scheduledEndMs = Date.parse(targetBooking.endTime);
          if (!Number.isNaN(scheduledEndMs)) {
            const calculatedRevisedMs = scheduledEndMs + delay * 60000;
            // Contradictory if discrepancy exceeds 1 minute (60,000 ms)
            if (Math.abs(reportedRevisedMs - calculatedRevisedMs) > 60000) {
              errors.push(
                `Contradictory disruption input: revisedArrivalTime "${candidate.revisedArrivalTime}" contradicts scheduled arrival "${targetBooking.endTime}" plus delay of ${delay} minutes.`
              );
            }
          }
        } else if (targetBooking.startTime) {
          const scheduledStartMs = Date.parse(targetBooking.startTime);
          if (!Number.isNaN(scheduledStartMs)) {
            const calculatedStartMs = scheduledStartMs + delay * 60000;
            if (reportedRevisedMs < calculatedStartMs) {
              errors.push(
                `Contradictory disruption input: revisedArrivalTime "${candidate.revisedArrivalTime}" cannot precede revised departure.`
              );
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const validated: DisruptionInput =
    type === 'delay'
      ? {
          type: 'delay',
          targetBookingId: candidate.targetBookingId as string,
          delayMinutes: candidate.delayMinutes as number,
          revisedArrivalTime: candidate.revisedArrivalTime
            ? (candidate.revisedArrivalTime as string)
            : undefined,
        }
      : {
          type: 'cancellation',
          targetBookingId: candidate.targetBookingId as string,
        };

  return { success: true, errors: [], data: validated };
}
