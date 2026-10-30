/**
 * TripSync - Change-Aware Financial Recalculation Types
 * The Central USP domain contracts.
 */

export type FinancialEventType =
  | 'booking_cancellation'
  | 'booking_price_change'
  | 'member_departure';

export interface MemberFinancialDelta {
  memberId: string;
  memberName: string;
  priorLiability: number;
  updatedLiability: number;
  deltaAmount: number; // positive = owes more, negative = gets refund / owes less
  refundCredit: number; // amount refunded to this member
  unrecoverableLoss: number; // confirmed non-refundable forfeiture absorbed by this member
  priorNetBalance: number;
  updatedNetBalance: number;
  remainingPersonalBudget: number;
  isBudgetExceeded: boolean;
  explanation: string;
}

export interface FinancialImpactSnapshot {
  id: string;
  tripId: string;
  eventType: FinancialEventType;
  triggerEntityId: string; // bookingId or memberId
  title: string;
  summary: string;
  allocationPolicy: string; // Explicit explanation of how non-refundable costs or shared gaps are treated
  memberDeltas: MemberFinancialDelta[];
  totalRefundGenerated: number;
  totalUnrecoverableLoss: number;
  calculatedAt: string;
}
