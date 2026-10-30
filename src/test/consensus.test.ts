import { describe, it, expect } from 'vitest';
import {
  evaluateGroupConsensus,
  rankRecoveryPlansForGroup,
  CandidateItineraryInput,
} from '../domain/consensus/consensus.engine';
import { SAMPLE_TRIP } from '../lib/demo-data';
import { TripMember } from '../domain/group/member.types';
import { RecoveryPlan } from '../domain/recovery/recovery.types';

describe('TripSync - Group Preference Balancing & Consensus Engine (X-Factor)', () => {
  const testMembers: TripMember[] = [
    {
      id: 'm1',
      tripId: 'test-trip',
      name: 'Aarav (Budget / Sightseeing)',
      email: 'aarav@test.com',
      role: 'organizer',
      status: 'active',
      personalBudget: 15000,
      preferences: {
        activityInterests: ['sightseeing', 'beaches'],
        costSensitivity: 'budget',
        preferredPace: 'moderate',
        priority: 'minimize-cost',
        willingnessToPayExtraForSpeed: 0.2,
      },
    },
    {
      id: 'm2',
      tripId: 'test-trip',
      name: 'Priya (Splurge / Luxury / Watersports)',
      email: 'priya@test.com',
      role: 'member',
      status: 'active',
      personalBudget: 50000,
      preferences: {
        activityInterests: ['watersports', 'culinary'],
        costSensitivity: 'splurge',
        preferredPace: 'relaxed',
        priority: 'preserve-activity',
        willingnessToPayExtraForSpeed: 0.8,
      },
    },
  ];

  describe('Candidate Itinerary Consensus Scoring', () => {
    it('evaluates candidate itinerary and produces overallScore, fairnessIndex, and budget feasibility', () => {
      const candidate: CandidateItineraryInput = {
        id: 'itinerary-1',
        title: 'Balanced North Goa Getaway',
        description: 'Standard resort with beach visits',
        bookings: [
          {
            id: 'b1',
            type: 'lodging',
            provider: 'Beach Resort',
            cost: 16000,
            currency: 'INR',
            participantMemberIds: ['m1', 'm2'],
            status: 'confirmed',
          } as any,
          {
            id: 'b2',
            type: 'activity',
            provider: 'Watersports & Scuba Center',
            cost: 6000,
            currency: 'INR',
            participantMemberIds: ['m1', 'm2'],
            status: 'confirmed',
          } as any,
        ],
      };

      const result = evaluateGroupConsensus(candidate, testMembers);

      expect(result.itineraryId).toBe('itinerary-1');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.fairnessIndex).toBeGreaterThanOrEqual(0);
      expect(result.fairnessIndex).toBeLessThanOrEqual(100);
      expect(result.allMembersWithinBudget).toBe(true);
      expect(result.budgetViolationsCount).toBe(0);
      expect(result.memberEvaluations).toHaveLength(2);
      expect(result.tradeOffSummary).toBeDefined();
    });

    it('identifies and penalizes personal budget violations for cost-constrained members', () => {
      // Itinerary costs 40,000 INR total -> 20,000 INR each
      // m1 personal budget is only 15,000 INR -> VIOLATION!
      const expensiveCandidate: CandidateItineraryInput = {
        id: 'itinerary-expensive',
        title: 'Ultra-Luxury Villa Package',
        description: 'High-end private villa',
        bookings: [
          {
            id: 'b-exp',
            type: 'lodging',
            provider: 'Luxury 5-Star Villa',
            cost: 40000,
            currency: 'INR',
            participantMemberIds: ['m1', 'm2'],
            status: 'confirmed',
          } as any,
        ],
      };

      const result = evaluateGroupConsensus(expensiveCandidate, testMembers);

      expect(result.allMembersWithinBudget).toBe(false);
      expect(result.budgetViolationsCount).toBe(1);

      const m1Eval = result.memberEvaluations.find((e) => e.memberId === 'm1');
      const m2Eval = result.memberEvaluations.find((e) => e.memberId === 'm2');

      expect(m1Eval?.isBudgetFeasible).toBe(false);
      expect(m1Eval?.budgetOverrunAmount).toBe(5000); // 20k - 15k
      expect(m1Eval?.individualFeedback).toContain('Budget breach');
      expect(m1Eval?.individualFeedback).toContain('exceeds personal limit');

      expect(m2Eval?.isBudgetFeasible).toBe(true);
      expect(m2Eval?.budgetOverrunAmount).toBe(0);

      expect(result.cons.some((c) => c.includes('Violates personal budget'))).toBe(true);
    });

    it('rewards itineraries matching member activity preferences', () => {
      const watersportsCandidate: CandidateItineraryInput = {
        id: 'itinerary-water',
        title: 'Adventure & Watersports',
        description: 'Scuba and jet ski package',
        bookings: [
          {
            id: 'b-act',
            type: 'activity',
            provider: 'Goa Watersports Club',
            cost: 4000,
            currency: 'INR',
            participantMemberIds: ['m1', 'm2'],
            status: 'confirmed',
          } as any,
        ],
      };

      const result = evaluateGroupConsensus(watersportsCandidate, testMembers);
      const priyaEval = result.memberEvaluations.find((e) => e.memberId === 'm2');

      // Priya has watersports interest -> activityMatchScore should be 95
      expect(priyaEval?.activityMatchScore).toBe(95);
    });
  });

  describe('Recovery Plan Group Ranking', () => {
    it('ranks recovery plans prioritizing budget feasibility and group consensus score', () => {
      const mockPlans: RecoveryPlan[] = [
        {
          id: 'plan-expensive-fast',
          name: 'Express Charter Flight',
          description: 'High speed alternative at significant premium',
          options: [],
          isFeasible: true,
          isFallback: false,
          infeasibilityReasons: [],
          commitments: [],
          additionalSpending: 80000, // Very expensive -> violates m1 budget
          nonRefundableCashLoss: 0,
          currency: 'INR',
          experienceValueLost: 0,
          estimatedArrivalAtDestination: '2026-11-10T12:00:00Z',
          assumptionsAndUnknowns: [],
          isRecommended: false,
          recommendationReason: '',
        },
        {
          id: 'plan-budget-safe',
          name: 'Economy Rail Transfer',
          description: 'Affordable transfer within all member budgets',
          options: [],
          isFeasible: true,
          isFallback: false,
          infeasibilityReasons: [],
          commitments: [],
          additionalSpending: 4000, // 2k each -> within both budgets
          nonRefundableCashLoss: 0,
          currency: 'INR',
          experienceValueLost: 0,
          estimatedArrivalAtDestination: '2026-11-10T15:00:00Z',
          assumptionsAndUnknowns: [],
          isRecommended: true,
          recommendationReason: '',
        },
      ];

      const ranked = rankRecoveryPlansForGroup(
        mockPlans,
        SAMPLE_TRIP.bookings,
        testMembers
      );

      expect(ranked).toHaveLength(2);
      // The budget-safe plan must rank #1 because all members are within budget
      expect(ranked[0]?.plan.id).toBe('plan-budget-safe');
      expect(ranked[0]?.consensus.rank).toBe(1);
      expect(ranked[0]?.consensus.allMembersWithinBudget).toBe(true);

      // The expensive plan violates m1's budget and is ranked lower
      expect(ranked[1]?.plan.id).toBe('plan-expensive-fast');
      expect(ranked[1]?.consensus.allMembersWithinBudget).toBe(false);
    });
  });
});
