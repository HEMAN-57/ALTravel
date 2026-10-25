import { describe, it, expect } from 'vitest';
import { validateBooking } from '../domain/bookings/booking.validation';
import { validateTrip } from '../domain/trips/trip.validation';
import { Booking } from '../domain/bookings/booking.types';
import { Trip } from '../domain/trips/trip.types';

describe('Domain Model: Booking Validation', () => {
  const validBookingData: Booking = {
    id: 'b-101',
    tripId: 't-1',
    type: 'flight',
    provider: 'IndiGo 6E-204',
    location: 'HYD -> DEL',
    startTime: '2026-11-10T10:00:00Z',
    endTime: '2026-11-10T12:15:00Z',
    cost: 5500,
    currency: 'INR',
    status: 'confirmed',
    cancellationDeadline: '2026-11-10T08:00:00Z',
    arrivalDeadline: '2026-11-10T09:15:00Z',
    cancellationPolicyNotes: 'Cancellation fee ₹3,000 applies.',
    notes: 'Gate opens 45 mins before flight.',
  };

  it('accepts a complete, valid booking', () => {
    const result = validateBooking(validBookingData);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data?.id).toBe('b-101');
    expect(result.data?.cost).toBe(5500);
  });

  it('rejects booking with missing required fields', () => {
    const invalid = { ...validBookingData, provider: '', id: '   ' };
    const result = validateBooking(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Booking ID is required'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Provider / booking name is required'))).toBe(true);
  });

  it('rejects an invalid booking type', () => {
    const invalid = { ...validBookingData, type: 'spaceship' };
    const result = validateBooking(invalid);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Booking type must be one of');
  });

  it('rejects a negative cost', () => {
    const invalid = { ...validBookingData, cost: -50 };
    const result = validateBooking(invalid);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Cost must be a non-negative number');
  });

  it('rejects end time that precedes start time', () => {
    const invalid = {
      ...validBookingData,
      startTime: '2026-11-10T12:00:00Z',
      endTime: '2026-11-10T10:00:00Z',
    };
    const result = validateBooking(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('End time cannot precede start time'))).toBe(true);
  });

  it('preserves optional fields as undefined when absent rather than inventing fake data', () => {
    const minimal = {
      id: 'b-min',
      tripId: 't-1',
      type: 'hotel',
      provider: 'City Stay',
      location: 'Goa',
      startTime: '2026-11-12T14:00:00Z',
      cost: 2000,
      currency: 'INR',
      status: 'confirmed',
    };
    const result = validateBooking(minimal);
    expect(result.success).toBe(true);
    expect(result.data?.endTime).toBeUndefined();
    expect(result.data?.cancellationDeadline).toBeUndefined();
    expect(result.data?.arrivalDeadline).toBeUndefined();
    expect(result.data?.notes).toBeUndefined();
  });
});

describe('Domain Model: Trip Validation', () => {
  const validTripData: Trip = {
    id: 't-1',
    name: 'Bangalore Tech Conference',
    origin: 'Hyderabad',
    destination: 'Bengaluru',
    startDate: '2026-11-15',
    endDate: '2026-11-18',
    bookings: [],
    createdAt: '2026-10-25T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
  };

  it('accepts a valid trip', () => {
    const result = validateTrip(validTripData);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data?.name).toBe('Bangalore Tech Conference');
  });

  it('rejects trip when end date is earlier than start date', () => {
    const invalid = {
      ...validTripData,
      startDate: '2026-11-20',
      endDate: '2026-11-15',
    };
    const result = validateTrip(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Trip end date cannot be earlier than start date'))).toBe(true);
  });

  it('rejects trip when origin or destination is missing', () => {
    const invalid = {
      ...validTripData,
      origin: '   ',
      destination: '',
    };
    const result = validateTrip(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('origin is required'))).toBe(true);
    expect(result.errors.some((e) => e.includes('destination is required'))).toBe(true);
  });

  it('validates nested bookings within the trip collection', () => {
    const invalidWithBookings = {
      ...validTripData,
      bookings: [
        {
          id: 'invalid-b-1',
          tripId: 't-1',
          type: 'invalid-type',
          provider: 'Unknown',
          location: 'Test',
          startTime: 'invalid-date',
          cost: -10,
          currency: 'INR',
          status: 'unknown-status',
        },
      ],
    };
    const result = validateTrip(invalidWithBookings);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Booking #1 is invalid'))).toBe(true);
  });
});
