/**
 * TripSync - Group Member Foundation Models
 */

export type MemberRole = 'organizer' | 'member';
export type MemberStatus = 'active' | 'departed';
export type CostSensitivity = 'budget' | 'balanced' | 'splurge';
export type TravelPace = 'relaxed' | 'moderate' | 'fast';
export type TravelPriority = 'minimize-cost' | 'preserve-activity' | 'earliest-arrival';

export interface MemberPreferences {
  activityInterests: string[]; // e.g. ['adventure', 'scuba', 'beach', 'culture', 'nightlife', 'food']
  costSensitivity: CostSensitivity;
  preferredPace: TravelPace;
  priority: TravelPriority;
  willingnessToPayExtraForSpeed: number; // 0 (strictly cheapest) to 1.0 (willing to pay for faster transit)
  mustPreserveBookingIds?: string[]; // IDs of non-negotiable bookings for this individual
}

export interface TripMember {
  id: string;
  tripId: string;
  name: string;
  email: string;
  avatar?: string;
  role: MemberRole;
  status: MemberStatus;
  departedAt?: string; // ISO timestamp if departed
  departureReason?: string;
  personalBudget: number; // Individual total trip budget limit in trip currency (e.g., INR)
  preferences: MemberPreferences;
}

export type CreateMemberInput = Omit<TripMember, 'id'> & { id?: string };
