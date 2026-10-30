/**
 * Explicit Dependency Model for TripSync
 * 
 * Expresses that an upstream travel booking affects a downstream booking.
 * Dependencies are NOT inferred merely because bookings belong to the same trip;
 * they must be explicitly defined with relationship semantics and transfer buffers.
 */

export type DependencyRelationshipType =
  | 'transit-connection' // e.g. feeder flight -> connecting flight, train -> connecting train
  | 'arrival-to-activity' // e.g. flight arrival -> time-sensitive prepaid excursion/tour
  | 'arrival-to-lodging'; // e.g. flight arrival -> hotel/resort check-in

export type BookingCommitmentType =
  | 'hard' // Hard deadline or non-negotiable departure (e.g. ticketed departure, strict gate cutoff)
  | 'flexible'; // Flexible arrival (e.g. standard hotel check-in window, 24h reception)

export interface BookingDependency {
  id: string;
  upstreamBookingId: string; // The predecessor booking (e.g. inbound flight)
  downstreamBookingId: string; // The dependent booking (e.g. connecting train or tour)
  relationshipType: DependencyRelationshipType;
  requiredBufferMinutes?: number; // Minimum transfer / transit buffer in minutes (e.g. 45 min)
  commitmentType: BookingCommitmentType;
  description?: string; // Optional context explaining the dependency rationale
}
