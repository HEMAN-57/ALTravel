import { Booking, BookingType, BookingStatus } from './booking.types';

export const VALID_BOOKING_TYPES: readonly BookingType[] = ['flight', 'train', 'hotel', 'activity'] as const;
export const VALID_BOOKING_STATUSES: readonly BookingStatus[] = ['confirmed', 'pending', 'delayed', 'cancelled', 'completed'] as const;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

export function isValidDateString(value: string): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
}

export function validateBooking(input: unknown): ValidationResult<Booking> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { success: false, errors: ['Booking payload must be a non-null object.'] };
  }

  const candidate = input as Record<string, unknown>;

  // id
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    errors.push('Booking ID is required and must be a non-empty string.');
  }

  // tripId
  if (typeof candidate.tripId !== 'string' || candidate.tripId.trim() === '') {
    errors.push('Associated trip ID is required and must be a non-empty string.');
  }

  // type
  if (
    typeof candidate.type !== 'string' ||
    !VALID_BOOKING_TYPES.includes(candidate.type as BookingType)
  ) {
    errors.push(`Booking type must be one of: ${VALID_BOOKING_TYPES.join(', ')}.`);
  }

  // provider
  if (typeof candidate.provider !== 'string' || candidate.provider.trim() === '') {
    errors.push('Provider / booking name is required.');
  }

  // location
  if (typeof candidate.location !== 'string' || candidate.location.trim() === '') {
    errors.push('Location is required.');
  }

  // startTime
  const isTransport = candidate.type === 'flight' || candidate.type === 'train';
  if (isTransport || candidate.startTime !== undefined) {
    if (typeof candidate.startTime !== 'string' || !isValidDateString(candidate.startTime)) {
      errors.push('Start time is required and must be a valid date/time string.');
    }
  }

  // endTime (optional)
  if (candidate.endTime !== undefined && candidate.endTime !== null) {
    if (typeof candidate.endTime !== 'string' || !isValidDateString(candidate.endTime)) {
      errors.push('End time, if specified, must be a valid date/time string.');
    } else if (
      typeof candidate.startTime === 'string' &&
      isValidDateString(candidate.startTime) &&
      new Date(candidate.endTime) < new Date(candidate.startTime)
    ) {
      errors.push('End time cannot precede start time.');
    }
  }

  // cost
  if (typeof candidate.cost !== 'number' || Number.isNaN(candidate.cost) || candidate.cost < 0) {
    errors.push('Cost must be a non-negative number.');
  }

  // currency
  if (typeof candidate.currency !== 'string' || candidate.currency.trim().length === 0) {
    errors.push('Currency code is required (e.g. INR, USD).');
  }

  // status
  if (
    typeof candidate.status !== 'string' ||
    !VALID_BOOKING_STATUSES.includes(candidate.status as BookingStatus)
  ) {
    errors.push(`Status must be one of: ${VALID_BOOKING_STATUSES.join(', ')}.`);
  }

  // cancellationDeadline (optional)
  if (
    candidate.cancellationDeadline !== undefined &&
    candidate.cancellationDeadline !== null
  ) {
    if (
      typeof candidate.cancellationDeadline !== 'string' ||
      !isValidDateString(candidate.cancellationDeadline)
    ) {
      errors.push('Cancellation deadline, if provided, must be a valid date/time string.');
    }
  }

  // arrivalDeadline (optional)
  if (
    candidate.arrivalDeadline !== undefined &&
    candidate.arrivalDeadline !== null
  ) {
    if (
      typeof candidate.arrivalDeadline !== 'string' ||
      !isValidDateString(candidate.arrivalDeadline)
    ) {
      errors.push('Arrival deadline, if provided, must be a valid date/time string.');
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const booking: Booking = {
    id: candidate.id as string,
    tripId: candidate.tripId as string,
    type: candidate.type as BookingType,
    provider: (candidate.provider as string).trim(),
    location: (candidate.location as string).trim(),
    startTime: candidate.startTime ? (candidate.startTime as string) : undefined,
    endTime: candidate.endTime ? (candidate.endTime as string) : undefined,
    cost: candidate.cost as number,
    currency: (candidate.currency as string).trim().toUpperCase(),
    status: candidate.status as BookingStatus,
    cancellationDeadline: candidate.cancellationDeadline
      ? (candidate.cancellationDeadline as string)
      : undefined,
    arrivalDeadline: candidate.arrivalDeadline
      ? (candidate.arrivalDeadline as string)
      : undefined,
    cancellationPolicyNotes:
      typeof candidate.cancellationPolicyNotes === 'string' &&
      candidate.cancellationPolicyNotes.trim() !== ''
        ? candidate.cancellationPolicyNotes.trim()
        : undefined,
    notes:
      typeof candidate.notes === 'string' && candidate.notes.trim() !== ''
        ? candidate.notes.trim()
        : undefined,
    confirmationReference:
      typeof candidate.confirmationReference === 'string' &&
      candidate.confirmationReference.trim() !== ''
        ? candidate.confirmationReference.trim()
        : undefined,
    participantMemberIds: Array.isArray(candidate.participantMemberIds)
      ? (candidate.participantMemberIds as string[])
      : undefined,
    paidByMemberId:
      typeof candidate.paidByMemberId === 'string' && candidate.paidByMemberId.trim() !== ''
        ? candidate.paidByMemberId.trim()
        : undefined,
    costType:
      candidate.costType === 'fixed_shared' || candidate.costType === 'per_person'
        ? candidate.costType
        : undefined,
  };

  return { success: true, data: booking, errors: [] };
}

