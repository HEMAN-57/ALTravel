/**
 * TripSync - Alert Engine
 * 
 * Automatically monitors trips for budget overruns, operational disruptions,
 * member roster shifts, and outstanding settlement debts.
 */

import { Trip } from '../trips/trip.types';
import { TripAlert } from './alert.types';
import { computeTripLedger } from '../expenses/splitting.engine';

export function generateTripAlerts(trip: Trip): TripAlert[] {
  const alerts: TripAlert[] = [];
  const ledger = computeTripLedger(trip);
  const currency = trip.bookings[0]?.currency || 'INR';

  // 1. Group Budget Alerts
  if (ledger.groupBudgetStatus === 'exceeded') {
    alerts.push({
      id: `alert-grp-budget-exc-${trip.id}`,
      tripId: trip.id,
      type: 'budget_threshold_warning',
      severity: 'critical',
      title: 'Group Budget Exceeded',
      message: `Total committed spend (${ledger.totalGroupCommittedSpend} ${currency}) exceeds group budget (${ledger.totalGroupBudget} ${currency}).`,
      createdAt: new Date().toISOString(),
    });
  } else if (ledger.groupBudgetStatus === 'warning') {
    alerts.push({
      id: `alert-grp-budget-warn-${trip.id}`,
      tripId: trip.id,
      type: 'budget_threshold_warning',
      severity: 'warning',
      title: 'Group Budget Nearing Limit',
      message: `Group committed spend has reached 85%+ of total budget (${ledger.totalGroupCommittedSpend} / ${ledger.totalGroupBudget} ${currency}).`,
      createdAt: new Date().toISOString(),
    });
  }

  // 2. Personal Member Budget Alerts
  ledger.memberSummaries.forEach((m) => {
    if (m.status === 'active' && m.budgetStatus === 'exceeded') {
      alerts.push({
        id: `alert-mem-budget-exc-${m.memberId}`,
        tripId: trip.id,
        type: 'personal_budget_exceeded',
        severity: 'critical',
        title: `Personal Budget Exceeded: ${m.memberName}`,
        message: `${m.memberName}'s allocated expenses (${m.committedSpend} ${currency}) exceed their personal budget (${m.personalBudget} ${currency}) by ${Math.abs(m.remainingBudget)} ${currency}.`,
        targetMemberId: m.memberId,
        targetMemberName: m.memberName,
        createdAt: new Date().toISOString(),
      });
    } else if (m.status === 'active' && m.budgetStatus === 'warning') {
      alerts.push({
        id: `alert-mem-budget-warn-${m.memberId}`,
        tripId: trip.id,
        type: 'budget_threshold_warning',
        severity: 'warning',
        title: `Budget Warning: ${m.memberName}`,
        message: `${m.memberName} has utilized ${m.budgetUtilizationPercent}% of their personal budget.`,
        targetMemberId: m.memberId,
        targetMemberName: m.memberName,
        createdAt: new Date().toISOString(),
      });
    }
  });

  // 3. Operational Disruption Alerts
  trip.bookings.forEach((b) => {
    if (b.status === 'cancelled') {
      alerts.push({
        id: `alert-booking-cancel-${b.id}`,
        tripId: trip.id,
        type: 'booking_disruption',
        severity: 'critical',
        title: `Booking Cancelled: ${b.provider}`,
        message: `${b.provider} (${b.type}) has been cancelled. Review change-aware recalculation for financial impacts.`,
        relatedEntityId: b.id,
        createdAt: new Date().toISOString(),
      });
    } else if (b.status === 'delayed') {
      alerts.push({
        id: `alert-booking-delay-${b.id}`,
        tripId: trip.id,
        type: 'booking_disruption',
        severity: 'warning',
        title: `Booking Delayed: ${b.provider}`,
        message: `${b.provider} is delayed. Check connecting dependencies for schedule buffer deficits.`,
        relatedEntityId: b.id,
        createdAt: new Date().toISOString(),
      });
    }
  });

  // 4. Member Departure Alerts
  if (trip.members) {
    trip.members.forEach((m) => {
      if (m.status === 'departed') {
        alerts.push({
          id: `alert-member-dep-${m.id}`,
          tripId: trip.id,
          type: 'member_change',
          severity: 'info',
          title: `Member Departed: ${m.name}`,
          message: `${m.name} has departed the trip. Shared commitments have been reallocated across remaining active members.`,
          targetMemberId: m.id,
          targetMemberName: m.name,
          createdAt: m.departedAt || new Date().toISOString(),
        });
      }
    });
  }

  // 5. Outstanding Settlement Alerts
  if (ledger.settlements.length > 0) {
    const totalPending = ledger.settlements.reduce((sum, s) => sum + s.amount, 0);
    alerts.push({
      id: `alert-settlements-${trip.id}`,
      tripId: trip.id,
      type: 'settlement_due',
      severity: 'info',
      title: 'Pending Group Settlements',
      message: `${ledger.settlements.length} settlement transaction(s) pending (${totalPending} ${currency} total).`,
      createdAt: new Date().toISOString(),
    });
  }

  return alerts;
}
