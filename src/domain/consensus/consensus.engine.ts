/**
 * TripSync - Group Preference Balancing & Consensus Engine
 * The Final X-Factor
 * 
 * Deterministically balances individual preferences, personal budget constraints,
 * and cost sensitivities to calculate an equitable group consensus score.
 */

import { TripMember } from '../group/member.types';
import { Booking } from '../bookings/booking.types';
import { RecoveryPlan } from '../recovery/recovery.types';
import { GroupConsensusScore, MemberEvaluation } from './consensus.types';
import { toPaise, fromPaise } from '../expenses/splitting.engine';

export interface CandidateItineraryInput {
  id: string;
  title: string;
  description: string;
  bookings: Booking[];
  additionalRecoveryCost?: number; // Extra spend if this is a recovery alternative
  estimatedArrival?: string;
  preservedActivityTypes?: string[];
}

/**
 * Evaluates an itinerary or recovery alternative against the entire group's preferences and personal budgets.
 */
export function evaluateGroupConsensus(
  itinerary: CandidateItineraryInput,
  members: TripMember[]
): GroupConsensusScore {
  const activeMembers = members.filter((m) => m.status === 'active');
  const activeCount = Math.max(1, activeMembers.length);

  const memberEvaluations: MemberEvaluation[] = activeMembers.map((member) => {

    // 1. Calculate this member's allocated cost share
    let memberShare = 0;
    itinerary.bookings.forEach((b) => {
      const participants = b.participantMemberIds && b.participantMemberIds.length > 0
        ? b.participantMemberIds
        : activeMembers.map((am) => am.id);

      if (participants.includes(member.id)) {
        memberShare += b.cost / participants.length;
      }
    });

    // Add recovery extra spend if applicable (split equally among active members)
    if (itinerary.additionalRecoveryCost && itinerary.additionalRecoveryCost > 0) {
      memberShare += itinerary.additionalRecoveryCost / activeCount;
    }

    memberShare = fromPaise(toPaise(memberShare));

    // 2. Budget Feasibility
    const budget = member.personalBudget || 20000;
    const isBudgetFeasible = memberShare <= budget;
    const budgetOverrun = Math.max(0, memberShare - budget);

    // 3. Cost Satisfaction Score (0 - 100)
    let costScore = 80;
    const budgetUsageRatio = budget > 0 ? memberShare / budget : 1;

    if (budgetUsageRatio <= 0.6) {
      costScore = 95;
    } else if (budgetUsageRatio <= 0.85) {
      costScore = 85;
    } else if (budgetUsageRatio <= 1.0) {
      costScore = 70;
    } else {
      // Over budget penalty
      const overrunPercent = (budgetOverrun / budget) * 100;
      costScore = Math.max(10, Math.round(50 - overrunPercent * 2));
    }

    // Adjust for cost sensitivity
    if (member.preferences.costSensitivity === 'budget') {
      if (budgetUsageRatio > 0.75) costScore -= 15;
    } else if (member.preferences.costSensitivity === 'splurge') {
      costScore = Math.min(100, costScore + 10);
    }

    // 4. Activity Match Score (0 - 100)
    let activityScore = 70;
    const activitiesInItinerary = itinerary.bookings
      .filter((b) => b.type === 'activity')
      .map((b) => b.provider.toLowerCase());

    const hasInterestMatch = member.preferences.activityInterests.some((interest) =>
      activitiesInItinerary.some((act) => act.includes(interest.toLowerCase()))
    );

    if (activitiesInItinerary.length > 0 && hasInterestMatch) {
      activityScore = 95;
    } else if (activitiesInItinerary.length === 0 && member.preferences.activityInterests.includes('relaxation')) {
      activityScore = 85;
    } else if (activitiesInItinerary.length === 0 && member.preferences.priority === 'preserve-activity') {
      activityScore = 40;
    }

    // 5. Pace Score (0 - 100)
    let paceScore = 80;
    if (member.preferences.preferredPace === 'fast' && itinerary.estimatedArrival) {
      paceScore = 90;
    } else if (member.preferences.preferredPace === 'relaxed') {
      paceScore = 85;
    }

    // Weighted member satisfaction score
    const satisfactionScore = Math.max(
      5,
      Math.min(
        100,
        Math.round(costScore * 0.45 + activityScore * 0.35 + paceScore * 0.2)
      )
    );

    let individualFeedback = '';
    if (!isBudgetFeasible) {
      individualFeedback = `Budget breach: allocated cost (${memberShare}) exceeds personal limit (${budget}) by ${budgetOverrun}.`;
    } else if (satisfactionScore >= 85) {
      individualFeedback = `Highly satisfied: aligned with budget and interests.`;
    } else if (satisfactionScore >= 70) {
      individualFeedback = `Acceptable compromise: satisfies core schedule within budget.`;
    } else {
      individualFeedback = `Low preference match or stretched budget.`;
    }

    return {
      memberId: member.id,
      memberName: member.name,
      satisfactionScore,
      activityMatchScore: activityScore,
      costSatisfactionScore: costScore,
      paceScore,
      allocatedCost: memberShare,
      personalBudget: budget,
      isBudgetFeasible,
      budgetOverrunAmount: budgetOverrun,
      individualFeedback,
    };
  });

  // Calculate Group Consensus Metrics
  const scores = memberEvaluations.map((e) => e.satisfactionScore);
  const meanScore = scores.reduce((sum, s) => sum + s, 0) / Math.max(1, scores.length);

  // Fairness index: penalized by standard deviation of satisfaction
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / Math.max(1, scores.length);
  const stdDev = Math.sqrt(variance);
  const fairnessIndex = Math.max(0, Math.min(100, Math.round(100 - stdDev * 1.5)));

  // Budget violations
  const budgetViolations = memberEvaluations.filter((e) => !e.isBudgetFeasible);
  const allMembersWithinBudget = budgetViolations.length === 0;

  // Penalize overall consensus score if any member is over budget
  let overallScore = Math.round(meanScore * 0.8 + fairnessIndex * 0.2);
  if (!allMembersWithinBudget) {
    overallScore = Math.max(15, overallScore - budgetViolations.length * 15);
  }

  // Pros, Cons, and Narrative
  const pros: string[] = [];
  const cons: string[] = [];

  if (allMembersWithinBudget) {
    pros.push('100% budget feasibility across all group members.');
  } else {
    cons.push(
      `Violates personal budget for: ${budgetViolations
        .map((v) => `${v.memberName} (+${v.budgetOverrunAmount})`)
        .join(', ')}.`
    );
  }

  if (fairnessIndex >= 80) {
    pros.push('Equitable satisfaction balance: minimal disparity between member scores.');
  } else {
    cons.push('Uneven compromise: significant preference disparity among group members.');
  }

  const satisfiedMembers = memberEvaluations.filter((e) => e.satisfactionScore >= 80);
  if (satisfiedMembers.length > 0) {
    pros.push(`Strongly favored by ${satisfiedMembers.map((m) => m.memberName).join(', ')}.`);
  }

  let tradeOffSummary = '';
  if (allMembersWithinBudget && overallScore >= 80) {
    tradeOffSummary = `Optimal group consensus (${overallScore}/100). Everyone is within personal budget limits with high satisfaction.`;
  } else if (!allMembersWithinBudget) {
    tradeOffSummary = `Controversial option: while attractive overall, it causes budget overruns for ${budgetViolations.map((v) => v.memberName).join(', ')}.`;
  } else {
    tradeOffSummary = `Solid compromise (${overallScore}/100): balances costs and activities without violating any personal budget.`;
  }

  return {
    itineraryId: itinerary.id,
    title: itinerary.title,
    overallScore,
    fairnessIndex,
    allMembersWithinBudget,
    budgetViolationsCount: budgetViolations.length,
    memberEvaluations,
    tradeOffSummary,
    pros,
    cons,
  };
}

/**
 * Compares recovery plans using group consensus scoring.
 */
export function rankRecoveryPlansForGroup(
  plans: RecoveryPlan[],
  tripBookings: Booking[],
  members: TripMember[]
): { plan: RecoveryPlan; consensus: GroupConsensusScore }[] {
  const evaluated = plans.map((plan) => {
    // Construct candidate itinerary representation
    const candidateBookings = tripBookings.map((b) => {
      // If plan dropped this booking
      const dropped = plan.commitments.some(
        (c) => c.bookingId === b.id && c.status === 'missed'
      );
      if (dropped) {
        return { ...b, cost: 0, status: 'cancelled' as const };
      }
      return b;
    });

    const candidateInput: CandidateItineraryInput = {
      id: plan.id,
      title: plan.name,
      description: plan.description,
      bookings: candidateBookings,
      additionalRecoveryCost: plan.additionalSpending,
      estimatedArrival: plan.estimatedArrivalAtDestination,
    };

    const consensus = evaluateGroupConsensus(candidateInput, members);
    return { plan, consensus };
  });

  // Sort: First by all members within budget, then by overall consensus score descending
  evaluated.sort((a, b) => {
    if (a.consensus.allMembersWithinBudget !== b.consensus.allMembersWithinBudget) {
      return a.consensus.allMembersWithinBudget ? -1 : 1;
    }
    return b.consensus.overallScore - a.consensus.overallScore;
  });

  evaluated.forEach((item, index) => {
    item.consensus.rank = index + 1;
  });

  return evaluated;
}
