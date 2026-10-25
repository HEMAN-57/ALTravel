import { Booking } from '../bookings/booking.types';

export interface Trip {
  id: string;
  name: string;
  origin: string;
  destination: string;
  startDate: string; // ISO 8601 date string (YYYY-MM-DD)
  endDate: string; // ISO 8601 date string (YYYY-MM-DD)
  bookings: Booking[];
  isSample?: boolean; // Visible indicator for simulated demo itineraries
  description?: string;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export type CreateTripInput = Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'bookings'> & {
  id?: string;
  bookings?: Booking[];
};
