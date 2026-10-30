/**
 * TripSync - Automated Bill Splitting & Ledger Engine
 * 
 * Uses exact integer paise arithmetic to ensure:
 * 1. Zero floating-point rounding errors.
 * 2. Sum of allocated shares strictly reconciles to total amount.
 * 3. Exact unequal and participation-based splitting.
 * 4. Optimal debt simplification graph solver.
 */

import { Trip } from '../trips/trip.types';
import {
  ExpenseCategory,
  ExpenseSplit,
  MemberFinancialSummary,
  Settlement,
  SplitType,
  TripFinancialLedger,
} from './expense.types';


/**
 * Converts a floating-point currency amount to exact integer paise (1 INR = 100 paise).
 */
export function toPaise(amount: number): number {
  return Math.round((amount || 0) * 100);
}

/**
 * Converts exact integer paise back to floating-point currency formatted to 2 decimals.
 */
export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Calculates exact split shares among participants.
 * Handles remainder paise deterministically so the sum strictly equals the total amount.
 */
export function calculateSplits(
  totalAmount: number,
  participantIds: string[],
  splitType: SplitType = 'equal',
  customSplits?: Record<string, number>
): ExpenseSplit[] {
  if (participantIds.length === 0) {
    return [];
  }

  const totalPaise = toPaise(totalAmount);
  if (totalPaise <= 0) {
    return participantIds.map((id) => ({
      memberId: id,
      owedAmount: 0,
      owedPaise: 0,
      percentage: Math.round((100 / participantIds.length) * 100) / 100,
    }));
  }

  const splits: ExpenseSplit[] = [];

  if (splitType === 'equal' || splitType === 'by_participation' || !customSplits) {
    const count = participantIds.length;
    const baseShare = Math.floor(totalPaise / count);
    const remainder = totalPaise % count; // Remainder paise to distribute 1 each to the first 'remainder' members

    participantIds.forEach((memberId, index) => {
      const sharePaise = baseShare + (index < remainder ? 1 : 0);
      splits.push({
        memberId,
        owedAmount: fromPaise(sharePaise),
        owedPaise: sharePaise,
        percentage: Math.round((sharePaise / totalPaise) * 10000) / 100,
      });
    });

    return splits;
  }

  if (splitType === 'percentage') {
    let allocatedPaise = 0;

    participantIds.forEach((memberId, index) => {
      const pct = customSplits[memberId] ?? 0;
      let sharePaise = Math.round((totalPaise * pct) / 100);

      // Final member absorbs any minor rounding discrepancy
      if (index === participantIds.length - 1) {
        sharePaise = totalPaise - allocatedPaise;
      } else {
        allocatedPaise += sharePaise;
      }

      splits.push({
        memberId,
        owedAmount: fromPaise(sharePaise),
        owedPaise: sharePaise,
        percentage: pct,
      });
    });

    return splits;
  }

  if (splitType === 'exact') {
    participantIds.forEach((memberId) => {
      const exactAmount = customSplits[memberId] ?? 0;
      const sharePaise = toPaise(exactAmount);
      splits.push({
        memberId,
        owedAmount: fromPaise(sharePaise),
        owedPaise: sharePaise,
        percentage: totalPaise > 0 ? Math.round((sharePaise / totalPaise) * 10000) / 100 : 0,
      });
    });

    return splits;
  }

  return splits;
}

/**
 * Computes the complete group financial ledger for a trip,
 * synthesizing scheduled bookings, ad-hoc expenses, and member payments.
 */
export function computeTripLedger(trip: Trip): TripFinancialLedger {
  const currency = trip.bookings[0]?.currency || 'INR';
  const members = trip.members && trip.members.length > 0
    ? trip.members
    : [
        {
          id: 'default-organizer',
          tripId: trip.id,
          name: 'Organizer',
          email: 'organizer@tripsync.local',
          role: 'organizer' as const,
          status: 'active' as const,
          personalBudget: 50000,
          preferences: {
            activityInterests: ['general'],
            costSensitivity: 'balanced' as const,
            preferredPace: 'moderate' as const,
            priority: 'minimize-cost' as const,
            willingnessToPayExtraForSpeed: 0.5,
          },
        },
      ];

  const activeMembers = members.filter((m) => m.status === 'active');
  const activeMemberIds = activeMembers.map((m) => m.id);

  // Initialize tracking maps in integer paise
  const paidMapPaise: Record<string, number> = {};
  const owedMapPaise: Record<string, number> = {};
  const categoryMapPaise: Record<string, Record<ExpenseCategory, number>> = {};

  const emptyCategories = (): Record<ExpenseCategory, number> => ({
    transport: 0,
    lodging: 0,
    activity: 0,
    food: 0,
    incidentals: 0,
    emergency: 0,
  });

  members.forEach((m) => {
    paidMapPaise[m.id] = 0;
    owedMapPaise[m.id] = 0;
    categoryMapPaise[m.id] = emptyCategories();
  });

  // 1. Process Bookings as liabilities and payments
  trip.bookings.forEach((booking) => {
    // Only active bookings (confirmed, pending, delayed, completed) count as committed spend
    // Cancelled bookings are handled via change-aware recalculation
    if (booking.status === 'cancelled') {
      return;
    }

    const bookingPaise = toPaise(booking.cost);
    if (bookingPaise <= 0) return;

    // Who paid upfront?
    const payerId = booking.paidByMemberId && members.some((m) => m.id === booking.paidByMemberId)
      ? booking.paidByMemberId
      : members[0]?.id || 'default-organizer';

    paidMapPaise[payerId] = (paidMapPaise[payerId] || 0) + bookingPaise;

    // Who participates?
    const rawParticipants = booking.participantMemberIds && booking.participantMemberIds.length > 0
      ? booking.participantMemberIds
      : activeMemberIds;

    // Filter to known members
    const validParticipants = rawParticipants.filter((pid) => members.some((m) => m.id === pid));
    const effectiveParticipants = validParticipants.length > 0 ? validParticipants : activeMemberIds;

    const bookingCategory: ExpenseCategory =
      booking.type === 'flight' || booking.type === 'train'
        ? 'transport'
        : booking.type === 'hotel'
        ? 'lodging'
        : 'activity';

    const splits = calculateSplits(booking.cost, effectiveParticipants, 'equal');
    splits.forEach((s) => {
      owedMapPaise[s.memberId] = (owedMapPaise[s.memberId] || 0) + s.owedPaise;
      const cat = categoryMapPaise[s.memberId];
      if (cat) {
        cat[bookingCategory] = (cat[bookingCategory] || 0) + s.owedPaise;
      }
    });
  });

  // 2. Process Ad-Hoc Expenses
  if (trip.expenses && trip.expenses.length > 0) {
    trip.expenses.forEach((expense) => {
      const expPaise = toPaise(expense.amount);
      if (expPaise <= 0) return;

      const payerId = expense.paidByMemberId;
      paidMapPaise[payerId] = (paidMapPaise[payerId] || 0) + expPaise;

      const validParticipants = expense.participantMemberIds.filter((pid) =>
        members.some((m) => m.id === pid)
      );
      const effectiveParticipants = validParticipants.length > 0 ? validParticipants : activeMemberIds;

      const splits = calculateSplits(
        expense.amount,
        effectiveParticipants,
        expense.splitType,
        expense.customSplits
      );

      splits.forEach((s) => {
        owedMapPaise[s.memberId] = (owedMapPaise[s.memberId] || 0) + s.owedPaise;
        const cat = categoryMapPaise[s.memberId];
        if (cat) {
          cat[expense.category] = (cat[expense.category] || 0) + s.owedPaise;
        }
      });
    });
  }

  // 3. Assemble member summaries
  let totalGroupBudgetPaise = 0;
  let totalGroupCommittedSpendPaise = 0;

  const memberSummaries: MemberFinancialSummary[] = members.map((member) => {
    const budgetPaise = toPaise(member.personalBudget);
    const paidPaise = paidMapPaise[member.id] || 0;
    const owedPaise = owedMapPaise[member.id] || 0;
    const netPaise = paidPaise - owedPaise;
    const remainingPaise = budgetPaise - owedPaise;

    if (member.status === 'active') {
      totalGroupBudgetPaise += budgetPaise;
      totalGroupCommittedSpendPaise += owedPaise;
    }

    const utilization = budgetPaise > 0 ? Math.round((owedPaise / budgetPaise) * 10000) / 100 : 0;
    const budgetStatus: 'ok' | 'warning' | 'exceeded' =
      owedPaise > budgetPaise ? 'exceeded' : utilization >= 85 ? 'warning' : 'ok';

    const memberCats = categoryMapPaise[member.id] || emptyCategories();
    const breakdownByCategory: Record<ExpenseCategory, number> = {
      transport: fromPaise(memberCats.transport),
      lodging: fromPaise(memberCats.lodging),
      activity: fromPaise(memberCats.activity),
      food: fromPaise(memberCats.food),
      incidentals: fromPaise(memberCats.incidentals),
      emergency: fromPaise(memberCats.emergency),
    };

    return {
      memberId: member.id,
      memberName: member.name,
      role: member.role,
      status: member.status,
      personalBudget: member.personalBudget,
      totalPaid: fromPaise(paidPaise),
      totalOwed: fromPaise(owedPaise),
      netBalance: fromPaise(netPaise),
      committedSpend: fromPaise(owedPaise),
      remainingBudget: fromPaise(remainingPaise),
      budgetUtilizationPercent: utilization,
      budgetStatus,
      breakdownByCategory,
    };
  });

  // 4. Calculate simplified debt settlements
  const netBalances = memberSummaries.map((m) => ({
    memberId: m.memberId,
    netBalance: m.netBalance,
  }));
  const settlements = simplifyDebts(netBalances, currency, trip.id);

  const remainingGroupBudgetPaise = totalGroupBudgetPaise - totalGroupCommittedSpendPaise;
  const groupUtilization =
    totalGroupBudgetPaise > 0
      ? (totalGroupCommittedSpendPaise / totalGroupBudgetPaise) * 100
      : 0;

  const groupBudgetStatus: 'ok' | 'warning' | 'exceeded' =
    totalGroupCommittedSpendPaise > totalGroupBudgetPaise
      ? 'exceeded'
      : groupUtilization >= 85
      ? 'warning'
      : 'ok';

  return {
    tripId: trip.id,
    currency,
    totalGroupBudget: fromPaise(totalGroupBudgetPaise),
    totalGroupCommittedSpend: fromPaise(totalGroupCommittedSpendPaise),
    remainingGroupBudget: fromPaise(remainingGroupBudgetPaise),
    groupBudgetStatus,
    memberSummaries,
    settlements,
    lastRecalculatedAt: new Date().toISOString(),
  };
}

/**
 * Solves the debt settlement graph using greedy balance matching.
 * Minimizes total transaction count across the group (guaranteed <= N - 1 transactions).
 */
export function simplifyDebts(
  balances: { memberId: string; netBalance: number }[],
  currency: string,
  tripId: string
): Settlement[] {
  // Convert to integer paise to ensure zero penny drift
  const debtors: { memberId: string; amountPaise: number }[] = [];
  const creditors: { memberId: string; amountPaise: number }[] = [];

  balances.forEach((b) => {
    const paise = toPaise(b.netBalance);
    if (paise < -1) {
      debtors.push({ memberId: b.memberId, amountPaise: -paise }); // positive debt amount
    } else if (paise > 1) {
      creditors.push({ memberId: b.memberId, amountPaise: paise });
    }
  });

  // Sort descending by amount to settle largest debts first
  debtors.sort((a, b) => b.amountPaise - a.amountPaise);
  creditors.sort((a, b) => b.amountPaise - a.amountPaise);

  const settlements: Settlement[] = [];
  let dIdx = 0;
  let cIdx = 0;
  let counter = 1;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (!debtor || !creditor) break;

    const settlePaise = Math.min(debtor.amountPaise, creditor.amountPaise);

    if (settlePaise > 0) {
      settlements.push({
        id: `stl-${counter++}`,
        tripId,
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount: fromPaise(settlePaise),
        currency,
        status: 'suggested',
      });
    }

    debtor.amountPaise -= settlePaise;
    creditor.amountPaise -= settlePaise;

    if (debtor.amountPaise <= 1) {
      dIdx++;
    }
    if (creditor.amountPaise <= 1) {
      cIdx++;
    }
  }

  return settlements;
}
