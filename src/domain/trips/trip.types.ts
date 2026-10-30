import { Booking } from '../bookings/booking.types';
import { BookingDependency } from '../disruptions/dependency.types';
import { TripMember } from '../group/member.types';
import { Expense, Settlement } from '../expenses/expense.types';
import { TripAlert } from '../alerts/alert.types';
import { FinancialImpactSnapshot } from '../recalculation/recalculation.types';

export interface Trip {
  id: string;
  name: string;
  origin: string;
  destination: string;
  startDate: string; // ISO 8601 date string (YYYY-MM-DD)
  endDate: string; // ISO 8601 date string (YYYY-MM-DD)
  bookings: Booking[];
  dependencies?: BookingDependency[]; // Explicit dependency graph between bookings
  isSample?: boolean; // Visible indicator for simulated demo itineraries
  userId?: string; // Associated user identity for account ownership
  description?: string;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp

  // TripSync Group & Financial extensions (optional for backward compatibility)
  members?: TripMember[];
  expenses?: Expense[];
  settlements?: Settlement[];
  alerts?: TripAlert[];
  financialSnapshots?: FinancialImpactSnapshot[];
  totalBudget?: number; // Optional group budget ceiling
}

export type CreateTripInput = Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'bookings'> & {
  id?: string;
  bookings?: Booking[];
};

