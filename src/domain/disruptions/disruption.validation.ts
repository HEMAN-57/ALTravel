import { Trip } from '../trips/trip.types';
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
  if (
    typeof candidate.targetBookingId !== 'string' ||
    candidate.targetBookingId.trim() === ''
  ) {
    errors.push('Target booking ID is required.');
  } else {
    const bookingExists = trip.bookings.some((b) => b.id === candidate.targetBookingId);
    if (!bookingExists) {
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
    if (
      typeof candidate.delayMinutes !== 'number' ||
      Number.isNaN(candidate.delayMinutes) ||
      candidate.delayMinutes < 0
    ) {
      errors.push(
        `Delay duration must be a non-negative number of minutes (received: ${String(candidate.delayMinutes)}).`
      );
    }

    if (
      candidate.revisedArrivalTime !== undefined &&
      candidate.revisedArrivalTime !== null &&
      candidate.revisedArrivalTime !== ''
    ) {
      if (
        typeof candidate.revisedArrivalTime !== 'string' ||
        !isValidDateString(candidate.revisedArrivalTime)
      ) {
        errors.push('Revised arrival time, if supplied, must be a valid ISO date/time string.');
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
