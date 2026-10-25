export type BookingType = 'flight' | 'train' | 'hotel' | 'activity';

export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'delayed'
  | 'cancelled'
  | 'completed';

export interface Booking {
  id: string;
  tripId: string;
  type: BookingType;
  provider: string; // e.g. "IndiGo 6E-532", "Taj Exotica Resort & Spa", "ScubaGoa Explorers"
  location: string; // e.g. "HYD -> GOI", "Benaulim Beach, South Goa"
  startTime?: string; // ISO 8601 string, required for transport bookings, optional when unknown or unscheduled
  endTime?: string; // ISO 8601 string, optional when unknown or instantaneous
  cost: number;
  currency: string; // Standard currency code e.g. "INR", "USD", "EUR"
  status: BookingStatus;
  cancellationDeadline?: string; // ISO 8601 string representing final free/standard cancellation cutoff
  arrivalDeadline?: string; // ISO 8601 string e.g. airport check-in or hotel late check-in cutoff
  cancellationPolicyNotes?: string; // Summary of terms, e.g. "Non-refundable within 24h of activity"
  notes?: string; // Optional user or traveller notes
  confirmationReference?: string; // PNR or confirmation identifier
}

export type CreateBookingInput = Omit<Booking, 'id'> & { id?: string };
