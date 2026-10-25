import { Trip } from './trip.types';
import { validateBooking, isValidDateString, ValidationResult } from '../bookings/booking.validation';
import { Booking } from '../bookings/booking.types';

export function validateTrip(input: unknown): ValidationResult<Trip> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { success: false, errors: ['Trip payload must be a non-null object.'] };
  }

  const candidate = input as Record<string, unknown>;

  // id
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    errors.push('Trip ID is required and must be a non-empty string.');
  }

  // name
  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
    errors.push('Trip name is required.');
  }

  // origin
  if (typeof candidate.origin !== 'string' || candidate.origin.trim() === '') {
    errors.push('Trip origin is required.');
  }

  // destination
  if (typeof candidate.destination !== 'string' || candidate.destination.trim() === '') {
    errors.push('Trip destination is required.');
  }

  // startDate
  if (typeof candidate.startDate !== 'string' || !isValidDateString(candidate.startDate)) {
    errors.push('Trip start date is required and must be a valid date string.');
  }

  // endDate
  if (typeof candidate.endDate !== 'string' || !isValidDateString(candidate.endDate)) {
    errors.push('Trip end date is required and must be a valid date string.');
  } else if (
    typeof candidate.startDate === 'string' &&
    isValidDateString(candidate.startDate) &&
    new Date(candidate.endDate) < new Date(candidate.startDate)
  ) {
    errors.push('Trip end date cannot be earlier than start date.');
  }

  // bookings collection
  const validatedBookings: Booking[] = [];
  if (candidate.bookings !== undefined) {
    if (!Array.isArray(candidate.bookings)) {
      errors.push('Trip bookings must be an array.');
    } else {
      candidate.bookings.forEach((item, index) => {
        const itemResult = validateBooking(item);
        if (!itemResult.success) {
          errors.push(
            `Booking #${index + 1} is invalid: ${itemResult.errors.join('; ')}`
          );
        } else if (itemResult.data) {
          validatedBookings.push(itemResult.data);
        }
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const now = new Date().toISOString();
  const trip: Trip = {
    id: candidate.id as string,
    name: (candidate.name as string).trim(),
    origin: (candidate.origin as string).trim(),
    destination: (candidate.destination as string).trim(),
    startDate: candidate.startDate as string,
    endDate: candidate.endDate as string,
    bookings: validatedBookings,
    isSample: Boolean(candidate.isSample),
    description:
      typeof candidate.description === 'string' && candidate.description.trim() !== ''
        ? candidate.description.trim()
        : undefined,
    createdAt:
      typeof candidate.createdAt === 'string' && isValidDateString(candidate.createdAt)
        ? candidate.createdAt
        : now,
    updatedAt:
      typeof candidate.updatedAt === 'string' && isValidDateString(candidate.updatedAt)
        ? candidate.updatedAt
        : now,
  };

  return { success: true, data: trip, errors: [] };
}
