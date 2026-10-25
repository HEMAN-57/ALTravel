import { Trip } from '../domain/trips/trip.types';

export const DEMO_TRIP_ID = 'demo-trip-hyd-goa';

/**
 * Synthetic demonstration trip clearly labelled as simulated.
 * Models a journey from Hyderabad to Goa with flight, hotel, and prepaid activity.
 */
export const SAMPLE_TRIP: Trip = {
  id: DEMO_TRIP_ID,
  name: 'Goa Coastal Getaway (Simulated Demo)',
  origin: 'Hyderabad (HYD)',
  destination: 'Goa (GOI)',
  startDate: '2026-11-12',
  endDate: '2026-11-16',
  isSample: true,
  description:
    'Synthetic demonstration itinerary modelling an outbound flight from Hyderabad to Goa, followed by a beachfront resort stay and a prepaid scuba diving excursion. All provider names, schedules, policies, and costs are simulated for architecture demonstration.',
  createdAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
  bookings: [
    {
      id: 'demo-booking-flight-1',
      tripId: DEMO_TRIP_ID,
      type: 'flight',
      provider: 'IndiGo 6E-532 (Simulated)',
      location: 'RGIA Hyderabad (HYD) → Dabolim Airport, Goa (GOI)',
      startTime: '2026-11-12T08:15:00+05:30',
      endTime: '2026-11-12T09:40:00+05:30',
      cost: 4850,
      currency: 'INR',
      status: 'confirmed',
      arrivalDeadline: '2026-11-12T07:15:00+05:30',
      cancellationDeadline: '2026-11-12T06:15:00+05:30',
      cancellationPolicyNotes:
        'Simulated policy: Airline cancellation fee ₹3,000 applies up to 2 hours prior to scheduled departure. Non-refundable thereafter.',
      confirmationReference: '6E-SIM-8921',
      notes: 'Flight operates out of Hyderabad Terminal 1. Baggage allowance: 15kg check-in, 7kg cabin.',
    },
    {
      id: 'demo-booking-hotel-1',
      tripId: DEMO_TRIP_ID,
      type: 'hotel',
      provider: 'Taj Exotica Resort & Spa, Goa (Simulated)',
      location: 'Benaulim Beach, South Goa, India',
      startTime: '2026-11-12T14:00:00+05:30',
      endTime: '2026-11-16T11:00:00+05:30',
      cost: 36000,
      currency: 'INR',
      status: 'confirmed',
      arrivalDeadline: '2026-11-12T23:59:00+05:30',
      cancellationDeadline: '2026-11-10T14:00:00+05:30',
      cancellationPolicyNotes:
        'Simulated policy: 100% refund if cancelled at least 48 hours before check-in. First night room charge retained for late cancellations.',
      confirmationReference: 'TAJ-GOA-7741',
      notes: 'Standard Deluxe Room with ocean view. Check-in from 14:00; early check-in subject to availability.',
    },
    {
      id: 'demo-booking-scuba-1',
      tripId: DEMO_TRIP_ID,
      type: 'activity',
      provider: 'Grande Island Scuba Adventures (Simulated)',
      location: 'Boat Jetty, Bogmalo / Grande Island, Goa',
      startTime: '2026-11-13T07:30:00+05:30',
      endTime: '2026-11-13T13:30:00+05:30',
      cost: 4200,
      currency: 'INR',
      status: 'confirmed',
      arrivalDeadline: '2026-11-13T07:00:00+05:30',
      cancellationDeadline: '2026-11-12T07:30:00+05:30',
      cancellationPolicyNotes:
        'Simulated policy: Fully prepaid. Free reschedule up to 24 hours prior; non-refundable within 24h due to reserved dive vessel slot and instructor assignment.',
      confirmationReference: 'DIVE-GOA-4412',
      notes: 'Includes 1 guided dive, safety briefing, gear rental, and underwater photos. High dependency on morning arrival.',
    },
  ],
  dependencies: [
    {
      id: 'demo-dep-flight-hotel',
      upstreamBookingId: 'demo-booking-flight-1',
      downstreamBookingId: 'demo-booking-hotel-1',
      relationshipType: 'arrival-to-lodging',
      requiredBufferMinutes: 120, // 2h airport egress, luggage collection, and transit to South Goa
      commitmentType: 'flexible',
      description: 'Flight arrival feeds into resort check-in; flexible evening reception.',
    },
    {
      id: 'demo-dep-flight-scuba',
      upstreamBookingId: 'demo-booking-flight-1',
      downstreamBookingId: 'demo-booking-scuba-1',
      relationshipType: 'arrival-to-activity',
      requiredBufferMinutes: 720, // Overnight rest before early morning scuba boat dispatch
      commitmentType: 'hard',
      description: 'Arrival in Goa prior to next morning prepaid dive boat cutoff.',
    },
  ],
};
