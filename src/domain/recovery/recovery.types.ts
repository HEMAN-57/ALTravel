/**
 * Milestone 3: Recovery Planning MVP Domain Types
 * Deterministic recovery models, feasibility constraints, and action plans.
 */

export type RecoveryOptionType =
  | 'alternative-transport'
  | 'local-transport'
  | 'contact-provider'
  | 'reschedule'
  | 'drop-commitment';

export type DeadlineType = 'user-entered' | 'unknown';

export type RecoveryPriority =
  | 'minimize-cost'
  | 'preserve-activity'
  | 'earliest-arrival';

/**
 * Individual candidate recovery option.
 * Captures only the data strictly needed to evaluate it.
 */
export interface RecoveryOption {
  id: string;
  tripId: string;
  title: string;
  description: string;
  type: RecoveryOptionType;
  additionalCost: number; // In trip's currency, must be non-negative
  currency: string;
  targetBookingId: string; // The affected booking or downstream commitment addressed
  expectedDepartureTime?: string; // ISO 8601 string where relevant
  expectedArrivalTime?: string; // ISO 8601 string where relevant
  deadline?: string; // ISO 8601 string if known
  deadlineType: DeadlineType;
  isSimulated: boolean; // Clearly labels synthetic demo options vs user-entered
  notes?: string;
}

/**
 * User-specified preferences and hard constraints.
 */
export interface UserRecoveryConstraints {
  priority: RecoveryPriority;
  maxBudget?: number; // Explicit hard budget constraint in trip currency
  criticalBookingIds?: string[]; // Non-negotiable commitments to preserve
  experienceValuePerBooking?: Record<string, number>; // Personal experience score (e.g. Scuba = 50 pts)
}

/**
 * Commitment outcome under a recovery plan.
 */
export interface PlanCommitmentOutcome {
  bookingId: string;
  bookingTitle: string;
  bookingType: string;
  status: 'preserved' | 'missed' | 'unaffected';
  reason: string;
  originalCost: number;
  isNonRefundable: boolean;
  lostExperienceValue: number;
}

/**
 * Evaluated recovery plan combining one or more options.
 */
export interface RecoveryPlan {
  id: string;
  name: string;
  description: string;
  options: RecoveryOption[];
  isFeasible: boolean;
  isFallback: boolean; // True if violates hard constraints but shown as infeasible fallback
  infeasibilityReasons: string[];
  additionalSpending: number; // Additional recovery spending (out-of-pocket)
  nonRefundableCashLoss: number; // Known non-refundable cash loss (strictly separate)
  currency: string;
  experienceValueLost: number; // Personal experience value lost (strictly separate dimension)
  commitments: PlanCommitmentOutcome[];
  estimatedArrivalAtDestination?: string;
  assumptionsAndUnknowns: string[];
  isRecommended: boolean;
  recommendationReason: string;
}

/**
 * Ordered action plan item for execution.
 */
export interface ActionItem {
  id: string;
  stepNumber: number;
  action: string; // What to do
  provider: string; // Related booking or provider
  deadline?: string; // ISO 8601 if known
  deadlineType: DeadlineType;
  deadlineDisplay: string; // Formatted date/time OR "Confirm deadline with provider."
  prerequisiteStepIds: string[]; // Step IDs that must precede this action
}

/**
 * Input to generate recovery comparison.
 */
export interface RecoveryPlanGenerationInput {
  tripId: string;
  options: RecoveryOption[];
  constraints: UserRecoveryConstraints;
}
