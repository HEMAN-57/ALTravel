import { describe, it, expect } from 'vitest';
import {
  toPaise,
  fromPaise,
  calculateSplits,
  computeTripLedger,
  simplifyDebts,
} from '../domain/expenses/splitting.engine';
import { SAMPLE_TRIP } from '../lib/demo-data';

describe('TripSync - Automated Bill Splitting & Ledger Engine', () => {
  describe('Integer Paise Conversion', () => {
    it('converts decimal currency amounts to exact integer paise', () => {
      expect(toPaise(100)).toBe(10000);
      expect(toPaise(100.5)).toBe(10050);
      expect(toPaise(0.01)).toBe(1);
      expect(toPaise(0.004)).toBe(0); // Math.round rounds to nearest paise
      expect(toPaise(12345.67)).toBe(1234567);
    });

    it('converts integer paise back to 2-decimal currency amounts', () => {
      expect(fromPaise(10000)).toBe(100);
      expect(fromPaise(10050)).toBe(100.5);
      expect(fromPaise(1)).toBe(0.01);
      expect(fromPaise(1234567)).toBe(12345.67);
    });
  });

  describe('Equal and Remainder Bill Splitting', () => {
    it('splits equally with deterministic remainder distribution and zero sum error', () => {
      // 100 INR among 3 members: 10000 paise / 3 = 3333 remainder 1 paise
      const splits = calculateSplits(100, ['m1', 'm2', 'm3'], 'equal');

      expect(splits).toHaveLength(3);
      expect(splits[0]!.owedPaise).toBe(3334);
      expect(splits[0]!.owedAmount).toBe(33.34);
      expect(splits[1]!.owedPaise).toBe(3333);
      expect(splits[1]!.owedAmount).toBe(33.33);
      expect(splits[2]!.owedPaise).toBe(3333);
      expect(splits[2]!.owedAmount).toBe(33.33);

      const totalSplitPaise = splits.reduce((sum, s) => sum + s.owedPaise, 0);
      expect(totalSplitPaise).toBe(10000);

      const totalSplitAmount = splits.reduce((sum, s) => sum + s.owedAmount, 0);
      expect(Math.round(totalSplitAmount * 100)).toBe(10000);
    });

    it('splits 1000 INR among 4 members evenly', () => {
      const splits = calculateSplits(1000, ['m1', 'm2', 'm3', 'm4'], 'equal');
      splits.forEach((s) => {
        expect(s.owedPaise).toBe(25000);
        expect(s.owedAmount).toBe(250);
      });
    });

    it('handles single participant taking full liability', () => {
      const splits = calculateSplits(750, ['solo-member'], 'equal');
      expect(splits).toHaveLength(1);
      expect(splits[0]!.owedPaise).toBe(75000);
      expect(splits[0]!.owedAmount).toBe(750);
      expect(splits[0]!.percentage).toBe(100);
    });

    it('handles empty participant list safely', () => {
      const splits = calculateSplits(500, [], 'equal');
      expect(splits).toEqual([]);
    });

    it('handles zero or negative amount gracefully', () => {
      const splits = calculateSplits(0, ['m1', 'm2'], 'equal');
      expect(splits).toHaveLength(2);
      expect(splits[0]!.owedAmount).toBe(0);
      expect(splits[1]!.owedAmount).toBe(0);
    });
  });

  describe('Percentage and Exact Splits', () => {
    it('splits by custom percentages with final member absorption of rounding drift', () => {
      const splits = calculateSplits(
        300,
        ['m1', 'm2', 'm3'],
        'percentage',
        { m1: 50, m2: 30, m3: 20 }
      );

      expect(splits[0]!.owedAmount).toBe(150);
      expect(splits[1]!.owedAmount).toBe(90);
      expect(splits[2]!.owedAmount).toBe(60);

      const total = splits.reduce((acc, s) => acc + s.owedPaise, 0);
      expect(total).toBe(30000);
    });

    it('splits by exact individual amounts', () => {
      const splits = calculateSplits(
        500,
        ['m1', 'm2'],
        'exact',
        { m1: 320, m2: 180 }
      );

      expect(splits[0]!.owedAmount).toBe(320);
      expect(splits[1]!.owedAmount).toBe(180);
      expect(splits[0]!.owedPaise + splits[1]!.owedPaise).toBe(50000);
    });
  });

  describe('Trip Financial Ledger Reconciliation', () => {
    it('computes total committed spending and personal summaries for 4-member Goa sample trip', () => {
      const ledger = computeTripLedger(SAMPLE_TRIP);

      expect(ledger.tripId).toBe(SAMPLE_TRIP.id);
      expect(ledger.currency).toBe('INR');
      expect(ledger.memberSummaries).toHaveLength(4);

      // Verify Total Group Budget = sum of individual budgets (22k + 15k + 12.5k + 18k = 67.5k)
      expect(ledger.totalGroupBudget).toBe(67500);

      // Verify that the sum of all members' totalOwed equals totalGroupCommittedSpend in paise
      const sumOfOwedPaise = ledger.memberSummaries.reduce(
        (sum, m) => sum + toPaise(m.totalOwed),
        0
      );
      expect(sumOfOwedPaise).toBe(toPaise(ledger.totalGroupCommittedSpend));

      // Fundamental Ledger Invariant: Net balances across all group members must sum to ZERO
      const sumOfNetBalancesPaise = ledger.memberSummaries.reduce(
        (sum, m) => sum + toPaise(m.netBalance),
        0
      );
      expect(Math.abs(sumOfNetBalancesPaise)).toBeLessThanOrEqual(1); // Within 1 paise due to integer round
    });

    it('correctly tracks participation-based expenses (e.g. Scuba activity attended by only 2 members)', () => {
      const ledger = computeTripLedger(SAMPLE_TRIP);
      const scubaBooking = SAMPLE_TRIP.bookings.find((b) => b.id === 'demo-booking-scuba-1');
      expect(scubaBooking).toBeDefined();
      expect(scubaBooking?.participantMemberIds).toEqual(['mem-aarav', 'mem-ananya']);

      const aaravSummary = ledger.memberSummaries.find((m) => m.memberId === 'mem-aarav');
      const priyaSummary = ledger.memberSummaries.find((m) => m.memberId === 'mem-priya');
      const rohanSummary = ledger.memberSummaries.find((m) => m.memberId === 'mem-rohan');
      const ananyaSummary = ledger.memberSummaries.find((m) => m.memberId === 'mem-ananya');

      // Aarav and Ananya attended Scuba (4,200 INR = 2,100 INR each)
      // Priya and Rohan did NOT attend Scuba, so their activity category spend should be 0
      expect(priyaSummary?.breakdownByCategory.activity).toBe(0);
      expect(rohanSummary?.breakdownByCategory.activity).toBe(0);
      expect(aaravSummary?.breakdownByCategory.activity).toBe(2100);
      expect(ananyaSummary?.breakdownByCategory.activity).toBe(2100);
    });
  });

  describe('Greedy Debt Simplification Graph Solver', () => {
    it('simplifies 3-party circular debts to minimal direct settlements', () => {
      // Member A is owed 50, Member B owes 30, Member C owes 20
      const balances = [
        { memberId: 'A', netBalance: 50 },
        { memberId: 'B', netBalance: -30 },
        { memberId: 'C', netBalance: -20 },
      ];

      const settlements = simplifyDebts(balances, 'INR', 'trip-123');

      expect(settlements).toHaveLength(2);
      expect(settlements).toContainEqual(
        expect.objectContaining({
          fromMemberId: 'B',
          toMemberId: 'A',
          amount: 30,
        })
      );
      expect(settlements).toContainEqual(
        expect.objectContaining({
          fromMemberId: 'C',
          toMemberId: 'A',
          amount: 20,
        })
      );
    });

    it('produces at most N-1 transactions for any N members', () => {
      const balances = [
        { memberId: 'm1', netBalance: 120 },
        { memberId: 'm2', netBalance: -40 },
        { memberId: 'm3', netBalance: -50 },
        { memberId: 'm4', netBalance: -30 },
      ];

      const settlements = simplifyDebts(balances, 'INR', 'trip-demo');
      expect(settlements.length).toBeLessThanOrEqual(3);

      const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
      expect(totalSettled).toBe(120);
    });

    it('returns empty array when all balances are zero', () => {
      const balances = [
        { memberId: 'A', netBalance: 0 },
        { memberId: 'B', netBalance: 0 },
      ];
      const settlements = simplifyDebts(balances, 'INR', 'trip-demo');
      expect(settlements).toEqual([]);
    });
  });
});
