import { Trip } from './trip.types';
import { validateBooking, isValidDateString, ValidationResult } from '../bookings/booking.validation';
import { Booking } from '../bookings/booking.types';
import { BookingDependency } from '../disruptions/dependency.types';
import { validateDependencies } from '../disruptions/dependency.validation';

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

  // isSample (must be boolean if provided, defaults to false if absent)
  let isSample = false;
  if (candidate.isSample !== undefined) {
    if (typeof candidate.isSample !== 'boolean') {
      errors.push('Trip isSample, if specified, must be a boolean (true or false).');
    } else {
      isSample = candidate.isSample;
    }
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
          if (itemResult.data.tripId !== candidate.id) {
            errors.push(
              `Booking #${index + 1} tripId ("${itemResult.data.tripId}") does not match parent trip ID ("${String(candidate.id)}").`
            );
          } else {
            validatedBookings.push(itemResult.data);
          }
        }
      });
    }
  }

  // dependencies collection (optional)
  let validatedDependencies: BookingDependency[] | undefined = undefined;
  if (candidate.dependencies !== undefined) {
    const depResult = validateDependencies(candidate.dependencies, validatedBookings);
    if (!depResult.success) {
      errors.push(...depResult.errors);
    } else {
      validatedDependencies = depResult.data;
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
    dependencies: validatedDependencies,
    isSample,
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
    members: Array.isArray(candidate.members) ? (candidate.members as Trip['members']) : undefined,
    expenses: Array.isArray(candidate.expenses) ? (candidate.expenses as Trip['expenses']) : undefined,
    settlements: Array.isArray(candidate.settlements) ? (candidate.settlements as Trip['settlements']) : undefined,
    alerts: Array.isArray(candidate.alerts) ? (candidate.alerts as Trip['alerts']) : undefined,
    financialSnapshots: Array.isArray(candidate.financialSnapshots)
      ? (candidate.financialSnapshots as Trip['financialSnapshots'])
      : undefined,
    totalBudget: typeof candidate.totalBudget === 'number' ? candidate.totalBudget : undefined,
  };

  return { success: true, data: trip, errors: [] };
}

