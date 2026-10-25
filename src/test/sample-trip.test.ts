import { describe, it, expect } from 'vitest';
import { SAMPLE_TRIP } from '../lib/demo-data';
import { validateTrip } from '../domain/trips/trip.validation';

describe('Sample Demo Trip Requirements', () => {
  it('passes comprehensive trip and booking validation', () => {
    const result = validateTrip(SAMPLE_TRIP);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('is explicitly labelled as simulated', () => {
    expect(SAMPLE_TRIP.isSample).toBe(true);
    expect(SAMPLE_TRIP.name.toLowerCase()).toContain('simulated');
    expect(SAMPLE_TRIP.description?.toLowerCase()).toContain('synthetic');
  });

  it('models a journey from Hyderabad to Goa', () => {
    expect(SAMPLE_TRIP.origin).toContain('Hyderabad');
    expect(SAMPLE_TRIP.destination).toContain('Goa');
  });

  it('contains an outbound flight, a hotel, and a prepaid scuba activity', () => {
    const types = SAMPLE_TRIP.bookings.map((b) => b.type);
    expect(types).toContain('flight');
    expect(types).toContain('hotel');
    expect(types).toContain('activity');

    const flight = SAMPLE_TRIP.bookings.find((b) => b.type === 'flight');
    expect(flight?.location).toContain('HYD');
    expect(flight?.location).toContain('GOI');
    expect(flight?.arrivalDeadline).toBeDefined();

    const hotel = SAMPLE_TRIP.bookings.find((b) => b.type === 'hotel');
    expect(hotel?.cancellationDeadline).toBeDefined();

    const scuba = SAMPLE_TRIP.bookings.find((b) => b.type === 'activity');
    expect(scuba?.provider.toLowerCase()).toContain('scuba');
    expect(scuba?.cancellationPolicyNotes?.toLowerCase()).toContain('prepaid');
  });
});
