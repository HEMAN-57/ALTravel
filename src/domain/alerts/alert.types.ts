/**
 * TripSync - Alert System Types
 */

export type AlertType =
  | 'budget_threshold_warning'
  | 'personal_budget_exceeded'
  | 'booking_disruption'
  | 'member_change'
  | 'financial_shift'
  | 'settlement_due';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface TripAlert {
  id: string;
  tripId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  targetMemberId?: string; // memberId if individual alert, undefined if group-wide
  targetMemberName?: string;
  relatedEntityId?: string;
  createdAt: string; // ISO timestamp
  read?: boolean;
}
