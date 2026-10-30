/**
 * TripSync - Expense & Bill Splitting Contracts
 */

export type SplitType = 'equal' | 'exact' | 'percentage' | 'by_participation';

export type ExpenseCategory =
  | 'transport'
  | 'lodging'
  | 'activity'
  | 'food'
  | 'incidentals'
  | 'emergency';

export interface ExpenseSplit {
  memberId: string;
  owedAmount: number; // In standard currency (e.g. 333.34)
  owedPaise: number; // Exact integer paise (e.g. 33334)
  percentage?: number;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  amount: number; // e.g. 1000.00
  currency: string;
  category: ExpenseCategory;
  paidByMemberId: string; // Member who paid upfront
  participantMemberIds: string[]; // Members participating in this expense
  splitType: SplitType;
  customSplits?: Record<string, number>; // memberId -> custom amount or percentage
  bookingId?: string; // Optional reference to an itinerary booking
  createdAt: string; // ISO 8601 string
  notes?: string;
}

export interface Settlement {
  id: string;
  tripId: string;
  fromMemberId: string; // Debtor
  toMemberId: string; // Creditor
  amount: number; // Amount in currency
  currency: string;
  status: 'suggested' | 'completed';
  settledAt?: string;
}

export interface MemberFinancialSummary {
  memberId: string;
  memberName: string;
  role: string;
  status: 'active' | 'departed';
  personalBudget: number;
  totalPaid: number; // Out-of-pocket money paid upfront for the group/bookings
  totalOwed: number; // Total liability allocated to this member
  netBalance: number; // totalPaid - totalOwed (> 0 is owed back, < 0 owes money)
  committedSpend: number; // Net committed expense liability
  remainingBudget: number; // personalBudget - committedSpend
  budgetUtilizationPercent: number; // (committedSpend / personalBudget) * 100
  budgetStatus: 'ok' | 'warning' | 'exceeded'; // warning if >= 85%, exceeded if > 100%
  breakdownByCategory: Record<ExpenseCategory, number>;
}

export interface TripFinancialLedger {
  tripId: string;
  currency: string;
  totalGroupBudget: number;
  totalGroupCommittedSpend: number;
  remainingGroupBudget: number;
  groupBudgetStatus: 'ok' | 'warning' | 'exceeded';
  memberSummaries: MemberFinancialSummary[];
  settlements: Settlement[];
  lastRecalculatedAt: string;
}
