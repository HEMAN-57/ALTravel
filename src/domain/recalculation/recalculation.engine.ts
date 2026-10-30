/**
 * TripSync - Change-Aware Financial Recalculation Engine
 * 
 * Central USP: Whenever bookings are cancelled, prices change, or members leave,
 * this engine recalculates the financial consequences for every affected member
 * with full mathematical transparency, explicit policy attribution, and zero silent losses.
 */

import { Trip } from '../trips/trip.types';
import { TripMember } from '../group/member.types';
import { Booking } from '../bookings/booking.types';
import { classifyBookingRefundability } from '../recovery/recovery.engine';
import { computeTripLedger, toPaise, fromPaise } from '../expenses/splitting.engine';
import {
  FinancialImpactSnapshot,
  MemberFinancialDelta,
} from './recalculation.types';


/**
 * Options configuring how shared costs are reallocated upon member departure.
 */
export interface MemberDepartureOptions {
  departingMemberId: string;
  reason?: string;
  policy: 'group_absorbs_shared' | 'departing_member_retains_liability';
  evaluationReferenceTime?: string;
}

/**
 * Recalculates financial responsibilities when a booking is cancelled.
 */
export function recalculateBookingCancellation(
  trip: Trip,
  cancelledBookingId: string,
  evaluationReferenceTime?: string
): { updatedTrip: Trip; snapshot: FinancialImpactSnapshot } {
  const targetBooking = trip.bookings.find((b) => b.id === cancelledBookingId);
  if (!targetBooking) {
    throw new Error(`Booking with ID "${cancelledBookingId}" not found in trip.`);
  }

  // Baseline ledger prior to cancellation
  const priorLedger = computeTripLedger(trip);
  const priorMap = new Map(priorLedger.memberSummaries.map((m) => [m.memberId, m]));

  const members = trip.members || [];
  const activeMembers = members.filter((m) => m.status === 'active');
  const participantIds = targetBooking.participantMemberIds && targetBooking.participantMemberIds.length > 0
    ? targetBooking.participantMemberIds
    : activeMembers.map((m) => m.id);

  // Check refundability deterministically via ALTravel policy classifier
  const evalTime = evaluationReferenceTime || targetBooking.startTime || new Date().toISOString();
  const refundInfo = classifyBookingRefundability(targetBooking, evalTime);

  const bookingCostPaise = toPaise(targetBooking.cost);
  const participantCount = participantIds.length;
  const sharePerParticipantPaise = participantCount > 0 ? Math.floor(bookingCostPaise / participantCount) : 0;
  const remainderPaise = participantCount > 0 ? bookingCostPaise % participantCount : 0;

  // Mark the booking as cancelled in the updated trip
  const updatedBookings: Booking[] = trip.bookings.map((b) =>
    b.id === cancelledBookingId ? { ...b, status: 'cancelled' as const } : b
  );

  const updatedTrip: Trip = {
    ...trip,
    bookings: updatedBookings,
    updatedAt: new Date().toISOString(),
  };

  // Compute updated ledger post-cancellation
  const updatedLedger = computeTripLedger(updatedTrip);
  const updatedMap = new Map(updatedLedger.memberSummaries.map((m) => [m.memberId, m]));

  let totalRefundGenerated = 0;
  let totalUnrecoverableLoss = 0;

  const memberDeltas: MemberFinancialDelta[] = members.map((member) => {
    const prior = priorMap.get(member.id);
    const updated = updatedMap.get(member.id);
    const priorLiab = prior?.totalOwed || 0;
    const updatedLiab = updated?.totalOwed || 0;

    const isParticipant = participantIds.includes(member.id);
    const pIndex = participantIds.indexOf(member.id);
    const memberSharePaise = isParticipant
      ? sharePerParticipantPaise + (pIndex < remainderPaise ? 1 : 0)
      : 0;
    const memberShareAmount = fromPaise(memberSharePaise);

    let refundCredit = 0;
    let unrecoverableLoss = 0;
    let explanation = '';

    if (!isParticipant) {
      explanation = 'Not participating in this booking; financial responsibility is unaffected.';
    } else if (refundInfo.status === 'refundable') {
      refundCredit = memberShareAmount;
      totalRefundGenerated += refundCredit;
      explanation = `Booking cancelled per policy (${refundInfo.explanation}). Full refund credit of ${memberShareAmount} ${targetBooking.currency} applied, reducing liability.`;
    } else if (refundInfo.status === 'non-refundable') {
      unrecoverableLoss = memberShareAmount;
      totalUnrecoverableLoss += unrecoverableLoss;
      explanation = `Booking cancelled but is non-refundable per provider terms (${refundInfo.explanation}). Cash forfeiture of ${memberShareAmount} ${targetBooking.currency} absorbed.`;
    } else {
      // Unknown refundability
      unrecoverableLoss = memberShareAmount;
      totalUnrecoverableLoss += unrecoverableLoss;
      explanation = `Booking cancelled; provider terms are unconfirmed (${refundInfo.explanation}). Amount of ${memberShareAmount} ${targetBooking.currency} remains at risk.`;
    }

    const priorNet = prior?.netBalance || 0;
    const updatedNet = updated?.netBalance || 0;
    const remainingBudget = (member.personalBudget || 0) - updatedLiab;

    return {
      memberId: member.id,
      memberName: member.name,
      priorLiability: priorLiab,
      updatedLiability: updatedLiab,
      deltaAmount: updatedLiab - priorLiab,
      refundCredit,
      unrecoverableLoss,
      priorNetBalance: priorNet,
      updatedNetBalance: updatedNet,
      remainingPersonalBudget: remainingBudget,
      isBudgetExceeded: remainingBudget < 0,
      explanation,
    };
  });

  const snapshot: FinancialImpactSnapshot = {
    id: `snap-cancel-${Date.now()}`,
    tripId: trip.id,
    eventType: 'booking_cancellation',
    triggerEntityId: cancelledBookingId,
    title: `Booking Cancelled: ${targetBooking.provider}`,
    summary: `${targetBooking.provider} (${targetBooking.cost} ${targetBooking.currency}) was cancelled. Refund policy: ${refundInfo.status.toUpperCase()}.`,
    allocationPolicy: refundInfo.status === 'refundable'
      ? '100% refund credited back to confirmed booking participants in proportion to their initial payment share.'
      : 'Non-refundable booking loss assigned directly to confirmed booking participants; non-participants pay zero.',
    memberDeltas,
    totalRefundGenerated,
    totalUnrecoverableLoss,
    calculatedAt: new Date().toISOString(),
  };

  const finalTrip: Trip = {
    ...updatedTrip,
    financialSnapshots: [...(trip.financialSnapshots || []), snapshot],
  };

  return { updatedTrip: finalTrip, snapshot };
}

/**
 * Recalculates financial responsibilities when a booking price changes (surcharge or discount).
 */
export function recalculateBookingPriceChange(
  trip: Trip,
  bookingId: string,
  newPrice: number
): { updatedTrip: Trip; snapshot: FinancialImpactSnapshot } {
  const targetBooking = trip.bookings.find((b) => b.id === bookingId);
  if (!targetBooking) {
    throw new Error(`Booking with ID "${bookingId}" not found in trip.`);
  }

  const priorLedger = computeTripLedger(trip);
  const priorMap = new Map(priorLedger.memberSummaries.map((m) => [m.memberId, m]));

  const oldPrice = targetBooking.cost;
  const priceDelta = newPrice - oldPrice;

  // Update booking price
  const updatedBookings: Booking[] = trip.bookings.map((b) =>
    b.id === bookingId ? { ...b, cost: newPrice } : b
  );

  const updatedTrip: Trip = {
    ...trip,
    bookings: updatedBookings,
    updatedAt: new Date().toISOString(),
  };

  const updatedLedger = computeTripLedger(updatedTrip);
  const updatedMap = new Map(updatedLedger.memberSummaries.map((m) => [m.memberId, m]));

  const members = trip.members || [];
  const activeMembers = members.filter((m) => m.status === 'active');
  const participantIds = targetBooking.participantMemberIds && targetBooking.participantMemberIds.length > 0
    ? targetBooking.participantMemberIds
    : activeMembers.map((m) => m.id);

  const memberDeltas: MemberFinancialDelta[] = members.map((member) => {
    const prior = priorMap.get(member.id);
    const updated = updatedMap.get(member.id);
    const priorLiab = prior?.totalOwed || 0;
    const updatedLiab = updated?.totalOwed || 0;
    const delta = updatedLiab - priorLiab;

    const isParticipant = participantIds.includes(member.id);
    let explanation = '';

    if (!isParticipant) {
      explanation = 'Not participating in this booking; unaffected by price change.';
    } else if (delta > 0) {
      explanation = `Price increased by ${priceDelta} ${targetBooking.currency}. Individual share increased by ${delta} ${targetBooking.currency}.`;
    } else if (delta < 0) {
      explanation = `Price reduced by ${Math.abs(priceDelta)} ${targetBooking.currency}. Individual savings of ${Math.abs(delta)} ${targetBooking.currency} applied.`;
    } else {
      explanation = 'No price change.';
    }

    const remainingBudget = (member.personalBudget || 0) - updatedLiab;

    return {
      memberId: member.id,
      memberName: member.name,
      priorLiability: priorLiab,
      updatedLiability: updatedLiab,
      deltaAmount: delta,
      refundCredit: delta < 0 ? Math.abs(delta) : 0,
      unrecoverableLoss: 0,
      priorNetBalance: prior?.netBalance || 0,
      updatedNetBalance: updated?.netBalance || 0,
      remainingPersonalBudget: remainingBudget,
      isBudgetExceeded: remainingBudget < 0,
      explanation,
    };
  });

  const snapshot: FinancialImpactSnapshot = {
    id: `snap-price-${Date.now()}`,
    tripId: trip.id,
    eventType: 'booking_price_change',
    triggerEntityId: bookingId,
    title: `Price Change: ${targetBooking.provider}`,
    summary: `${targetBooking.provider} price updated from ${oldPrice} to ${newPrice} ${targetBooking.currency} (Net delta: ${priceDelta > 0 ? '+' : ''}${priceDelta} ${targetBooking.currency}).`,
    allocationPolicy: 'Price adjustment split equally among all confirmed booking participants.',
    memberDeltas,
    totalRefundGenerated: priceDelta < 0 ? Math.abs(priceDelta) : 0,
    totalUnrecoverableLoss: 0,
    calculatedAt: new Date().toISOString(),
  };

  const finalTrip: Trip = {
    ...updatedTrip,
    financialSnapshots: [...(trip.financialSnapshots || []), snapshot],
  };

  return { updatedTrip: finalTrip, snapshot };
}

/**
 * Recalculates financial responsibilities when a member departs from the trip.
 * Reallocates shared active expenses and establishes explicit policy for unrecoverable costs.
 */
export function recalculateMemberDeparture(
  trip: Trip,
  options: MemberDepartureOptions
): { updatedTrip: Trip; snapshot: FinancialImpactSnapshot } {
  const members = trip.members || [];
  const departingMember = members.find((m) => m.id === options.departingMemberId);
  if (!departingMember) {
    throw new Error(`Member with ID "${options.departingMemberId}" not found in trip.`);
  }

  // Baseline ledger prior to departure
  const priorLedger = computeTripLedger(trip);
  const priorMap = new Map(priorLedger.memberSummaries.map((m) => [m.memberId, m]));

  // Update member status to 'departed'
  const updatedMembers: TripMember[] = members.map((m) =>
    m.id === options.departingMemberId
      ? {
          ...m,
          status: 'departed' as const,
          departedAt: new Date().toISOString(),
          departureReason: options.reason || 'Personal emergency / early departure',
        }
      : m
  );

  const remainingActiveMembers = updatedMembers.filter((m) => m.status === 'active');


  // Update bookings:
  // If policy is 'group_absorbs_shared', shared bookings (hotels, cars) have departing member removed from participants,
  // so their cost is re-divided across remaining active members.
  // Optional individual bookings (e.g. Scuba) attended solely by departing member are cancelled or unassigned.
  const updatedBookings: Booking[] = trip.bookings.map((booking) => {
    const isParticipant = (booking.participantMemberIds || []).includes(options.departingMemberId);
    if (!isParticipant) {
      return booking;
    }

    if (options.policy === 'group_absorbs_shared') {
      const newParticipants = (booking.participantMemberIds || []).filter(
        (id) => id !== options.departingMemberId
      );

      // If no participants remain for an optional activity, mark as cancelled
      if (newParticipants.length === 0) {
        return {
          ...booking,
          status: 'cancelled' as const,
          participantMemberIds: [],
        };
      }

      return {
        ...booking,
        participantMemberIds: newParticipants,
      };
    }

    return booking;
  });

  const updatedTrip: Trip = {
    ...trip,
    members: updatedMembers,
    bookings: updatedBookings,
    updatedAt: new Date().toISOString(),
  };

  const updatedLedger = computeTripLedger(updatedTrip);
  const updatedMap = new Map(updatedLedger.memberSummaries.map((m) => [m.memberId, m]));

  const memberDeltas: MemberFinancialDelta[] = updatedMembers.map((member) => {
    const prior = priorMap.get(member.id);
    const updated = updatedMap.get(member.id);
    const priorLiab = prior?.totalOwed || 0;
    const updatedLiab = updated?.totalOwed || 0;
    const delta = updatedLiab - priorLiab;

    let explanation = '';

    if (member.id === options.departingMemberId) {
      if (options.policy === 'group_absorbs_shared') {
        explanation = `Departed trip. Released from remaining active shared obligations (Liability reduced by ${Math.abs(delta)} ${trip.bookings[0]?.currency || 'INR'}).`;
      } else {
        explanation = 'Departed trip under strict liability. Committed bookings remain assigned.';
      }
    } else {
      if (delta > 0) {
        explanation = `Share of fixed shared bookings (e.g. lodging/transit) increased by ${delta} ${trip.bookings[0]?.currency || 'INR'} to absorb ${departingMember.name}'s departure.`;
      } else if (delta < 0) {
        explanation = `Liability decreased by ${Math.abs(delta)} ${trip.bookings[0]?.currency || 'INR'}.`;
      } else {
        explanation = 'No change in financial liability.';
      }
    }

    const remainingBudget = (member.personalBudget || 0) - updatedLiab;

    return {
      memberId: member.id,
      memberName: member.name,
      priorLiability: priorLiab,
      updatedLiability: updatedLiab,
      deltaAmount: delta,
      refundCredit: delta < 0 ? Math.abs(delta) : 0,
      unrecoverableLoss: 0,
      priorNetBalance: prior?.netBalance || 0,
      updatedNetBalance: updated?.netBalance || 0,
      remainingPersonalBudget: remainingBudget,
      isBudgetExceeded: remainingBudget < 0,
      explanation,
    };
  });

  const snapshot: FinancialImpactSnapshot = {
    id: `snap-depart-${Date.now()}`,
    tripId: trip.id,
    eventType: 'member_departure',
    triggerEntityId: options.departingMemberId,
    title: `Member Departure: ${departingMember.name}`,
    summary: `${departingMember.name} has departed the trip. Shared commitments reallocated across the ${remainingActiveMembers.length} remaining active members.`,
    allocationPolicy: options.policy === 'group_absorbs_shared'
      ? 'Group Absorption: Shared accommodation and transit fixed costs are absorbed equally by remaining active members. Individual bookings for departing member are cancelled.'
      : 'Strict Liability: Departing member retains financial responsibility for all committed bookings.',
    memberDeltas,
    totalRefundGenerated: 0,
    totalUnrecoverableLoss: 0,
    calculatedAt: new Date().toISOString(),
  };

  const finalTrip: Trip = {
    ...updatedTrip,
    financialSnapshots: [...(trip.financialSnapshots || []), snapshot],
  };

  return { updatedTrip: finalTrip, snapshot };
}
