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

export const DEMO_DISRUPTION = {
  type: 'delay' as const,
  targetBookingId: 'demo-booking-flight-1',
  delayMinutes: 240, // 4-hour flight delay
};

export const DEMO_RECOVERY_OPTIONS = [
  {
    id: 'demo-opt-flight-alt',
    tripId: DEMO_TRIP_ID,
    title: 'Alternative Flight: Air India Express IX-412 (Simulated)',
    description: 'Direct alternative flight departing at 11:30 and arriving at 13:00. Fast arrival preserves both resort check-in and next-morning Scuba Diving.',
    type: 'alternative-transport' as const,
    additionalCost: 4200,
    currency: 'INR',
    targetBookingId: 'demo-booking-flight-1',
    expectedDepartureTime: '2026-11-12T11:30:00+05:30',
    expectedArrivalTime: '2026-11-12T13:00:00+05:30',
    deadline: '2026-11-12T10:15:00+05:30',
    deadlineType: 'user-entered' as const,
    isSimulated: true, // Visibly labelled as simulated demo data
    notes: 'Simulated fare and schedule for demonstration purposes only.',
  },
  {
    id: 'demo-opt-train-alt',
    tripId: DEMO_TRIP_ID,
    title: 'Budget Train: Vande Bharat Express (Simulated)',
    description: 'Economical afternoon train departing 12:00, arriving in Goa at 20:30. Reaches hotel within check-in window (23:59), but late arrival forfeits next morning 07:00 scuba diving excursion.',
    type: 'alternative-transport' as const,
    additionalCost: 950,
    currency: 'INR',
    targetBookingId: 'demo-booking-flight-1',
    expectedDepartureTime: '2026-11-12T12:00:00+05:30',
    expectedArrivalTime: '2026-11-12T20:30:00+05:30',
    deadline: '2026-11-12T11:00:00+05:30',
    deadlineType: 'user-entered' as const,
    isSimulated: true, // Visibly labelled as simulated demo data
    notes: 'Simulated train fare and schedule for demonstration purposes only.',
  },
  {
    id: 'demo-opt-local-cab',
    tripId: DEMO_TRIP_ID,
    title: 'Airport Prepaid Direct Cab (Local Ground Transit)',
    description: 'User-entered private airport taxi to Benaulim Beach resort. Saves 45 minutes of transit time compared to airport shuttle.',
    type: 'local-transport' as const,
    additionalCost: 1200,
    currency: 'INR',
    targetBookingId: 'demo-opt-flight-alt',
    expectedDepartureTime: '2026-11-12T13:15:00+05:30',
    expectedArrivalTime: '2026-11-12T14:15:00+05:30',
    deadline: undefined,
    deadlineType: 'unknown' as const,
    isSimulated: false, // User-entered local transport option
    notes: 'Estimated airport prepaid counter fare. Unknown deadline.',
  },
  {
    id: 'demo-opt-hotel-call',
    tripId: DEMO_TRIP_ID,
    title: 'Contact Hotel for Late Check-In Guarantee',
    description: 'Call Taj Exotica resort reception to request guaranteed room hold for evening arrival.',
    type: 'contact-provider' as const,
    additionalCost: 0,
    currency: 'INR',
    targetBookingId: 'demo-booking-hotel-1',
    deadline: '2026-11-12T18:00:00+05:30',
    deadlineType: 'user-entered' as const,
    isSimulated: true,
    notes: 'Check-in cutoff is 23:59.',
  },
];

