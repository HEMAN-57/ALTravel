/**
 * TripSync - Group Preference Balancing & Consensus Types
 */

export interface MemberEvaluation {

  memberId: string;
  memberName: string;
  satisfactionScore: number; // 0 to 100
  activityMatchScore: number; // 0 to 100
  costSatisfactionScore: number; // 0 to 100
  paceScore: number; // 0 to 100
  allocatedCost: number; // Member's share of this itinerary/option cost
  personalBudget: number;
  isBudgetFeasible: boolean; // false if allocatedCost > personalBudget (or remaining budget)
  budgetOverrunAmount: number; // max(0, allocatedCost - personalBudget)
  individualFeedback: string; // Explanatory text for this member
}

export interface GroupConsensusScore {
  itineraryId: string;
  title: string;
  overallScore: number; // 0 to 100 consensus score
  fairnessIndex: number; // 0 to 100 (high means equitable satisfaction across all members)
  allMembersWithinBudget: boolean;
  budgetViolationsCount: number;
  memberEvaluations: MemberEvaluation[];
  tradeOffSummary: string;
  pros: string[];
  cons: string[];
  rank?: number;
}
