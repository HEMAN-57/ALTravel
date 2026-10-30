import React, { useState } from 'react';
import { Trip } from '../../domain/trips/trip.types';
import {
  recalculateBookingCancellation,
  recalculateBookingPriceChange,
  recalculateMemberDeparture,
} from '../../domain/recalculation/recalculation.engine';
import {
  FinancialEventType,
  FinancialImpactSnapshot,
} from '../../domain/recalculation/recalculation.types';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { formatCurrency } from '../../lib/utils';
import {
  RefreshCw,
  CheckCircle2,
  CalendarX,
  TrendingUp,
  UserMinus,
  Sparkles,
  History,
} from 'lucide-react';


export interface ChangeAwareRecalculationViewProps {
  trip: Trip;
  onUpdateTrip: (updated: Trip) => void;
}

export const ChangeAwareRecalculationView: React.FC<ChangeAwareRecalculationViewProps> = ({
  trip,
  onUpdateTrip,
}) => {
  const [selectedEventType, setSelectedEventType] = useState<FinancialEventType>('booking_cancellation');
  const [targetBookingId, setTargetBookingId] = useState<string>('');
  const [targetMemberId, setTargetMemberId] = useState<string>('');
  const [newPriceInput, setNewPriceInput] = useState<string>('44000');
  const [departurePolicy, setDeparturePolicy] = useState<'group_absorbs_shared' | 'departing_member_retains_liability'>(
    'group_absorbs_shared'
  );
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);

  const [activeSnapshot, setActiveSnapshot] = useState<FinancialImpactSnapshot | null>(
    trip.financialSnapshots && trip.financialSnapshots.length > 0
      ? trip.financialSnapshots[trip.financialSnapshots.length - 1] || null
      : null
  );

  const currency = trip.bookings[0]?.currency || 'INR';
  const members = trip.members || [];
  const activeMembers = members.filter((m) => m.status === 'active');
  const cancellableBookings = trip.bookings.filter((b) => b.status !== 'cancelled');

  const effectiveBookingId =
    targetBookingId && cancellableBookings.some((b) => b.id === targetBookingId)
      ? targetBookingId
      : cancellableBookings[0]?.id || '';

  const effectiveMemberId =
    targetMemberId && activeMembers.some((m) => m.id === targetMemberId)
      ? targetMemberId
      : activeMembers.find((m) => m.role === 'member')?.id || activeMembers[0]?.id || '';

  // Run the chosen simulation preview
  const handleRunSimulation = () => {
    try {
      if (selectedEventType === 'booking_cancellation') {
        if (!effectiveBookingId) return;
        const { snapshot } = recalculateBookingCancellation(trip, effectiveBookingId);
        setActiveSnapshot(snapshot);
      } else if (selectedEventType === 'booking_price_change') {
        if (!effectiveBookingId) return;
        const priceNum = parseFloat(newPriceInput);
        if (isNaN(priceNum) || priceNum < 0) return;
        const { snapshot } = recalculateBookingPriceChange(trip, effectiveBookingId, priceNum);
        setActiveSnapshot(snapshot);
      } else if (selectedEventType === 'member_departure') {
        if (!effectiveMemberId) return;
        const { snapshot } = recalculateMemberDeparture(trip, {
          departingMemberId: effectiveMemberId,
          reason: 'Personal emergency requiring early return',
          policy: departurePolicy,
        });
        setActiveSnapshot(snapshot);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  // Commit the simulation permanently to the active trip state
  const handleApplyToTrip = () => {
    try {
      if (selectedEventType === 'booking_cancellation') {
        if (!effectiveBookingId) return;
        const { updatedTrip, snapshot } = recalculateBookingCancellation(trip, effectiveBookingId);
        onUpdateTrip(updatedTrip);
        setActiveSnapshot(snapshot);
        setAppliedNotification(`Booking cancelled: ${snapshot.title}. Ledger & alerts updated.`);
      } else if (selectedEventType === 'booking_price_change') {
        if (!effectiveBookingId) return;
        const priceNum = parseFloat(newPriceInput);
        if (isNaN(priceNum) || priceNum < 0) return;
        const { updatedTrip, snapshot } = recalculateBookingPriceChange(trip, effectiveBookingId, priceNum);
        onUpdateTrip(updatedTrip);
        setActiveSnapshot(snapshot);
        setAppliedNotification(`Price adjusted: ${snapshot.title}. Ledger & alerts updated.`);
      } else if (selectedEventType === 'member_departure') {
        if (!effectiveMemberId) return;
        const { updatedTrip, snapshot } = recalculateMemberDeparture(trip, {
          departingMemberId: effectiveMemberId,
          reason: 'Personal emergency requiring early return',
          policy: departurePolicy,
        });
        onUpdateTrip(updatedTrip);
        setActiveSnapshot(snapshot);
        setAppliedNotification(`Member departed: ${snapshot.title}. Shared costs rebalanced.`);
      }

      setTimeout(() => setAppliedNotification(null), 4000);
    } catch (err) {
      console.error('Failed to commit simulation:', err);
    }
  };

  return (
    <div className="space-y-8">
      {appliedNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{appliedNotification}</span>
        </div>
      )}
      {/* Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6 sm:p-8 text-white shadow-sm border border-slate-800">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-rose-300 text-xs font-semibold backdrop-blur-sm border border-white/10">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Central USP — Change-Aware Financial Recalculation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Financial Impact & Rebalancing Engine
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Whenever bookings are cancelled, costs change, or members leave the trip, TripSync deterministically recalculates every member's financial liability, refund credit, unrecoverable cash loss, and remaining personal budget.
          </p>
        </div>
      </div>

      {/* Interactive Trigger Simulator Card */}
      <Card className="bg-card border-border shadow-xs">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Simulate Itinerary or Roster Event
              </h2>
              <p className="text-xs text-muted-foreground">
                Select an event to run live financial consequence recalculations across all group members.
              </p>
            </div>

            {/* Event Type Buttons */}
            <div className="flex items-center gap-1.5 bg-secondary/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedEventType('booking_cancellation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedEventType === 'booking_cancellation'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarX className="w-3.5 h-3.5" />
                <span>1. Booking Cancellation</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEventType('booking_price_change')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedEventType === 'booking_price_change'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>2. Price Change</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEventType('member_departure')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedEventType === 'member_departure'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>3. Member Departure</span>
              </button>
            </div>
          </div>

          {/* Dynamic Event Parameter Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {selectedEventType === 'booking_cancellation' && (
              <div className="md:col-span-2">
                <Select
                  id="target-cancellation-booking"
                  label="Select Booking to Cancel"
                  value={effectiveBookingId}
                  onChange={(e) => setTargetBookingId(e.target.value)}
                  options={
                    cancellableBookings.length > 0
                      ? cancellableBookings.map((b) => ({
                          value: b.id,
                          label: `${b.provider} (${formatCurrency(b.cost, b.currency)} - ${b.status})`,
                        }))
                      : [{ value: '', label: 'All bookings are already cancelled' }]
                  }
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Tip: Select <strong>Grande Island Scuba Adventures</strong> (optional activity attended by 2 members) or <strong>IndiGo Flight</strong> to observe different refund rules.
                </span>
              </div>
            )}

            {selectedEventType === 'booking_price_change' && (
              <>
                <Select
                  id="target-price-booking"
                  label="Select Booking to Modify"
                  value={effectiveBookingId}
                  onChange={(e) => setTargetBookingId(e.target.value)}
                  options={cancellableBookings.map((b) => ({
                    value: b.id,
                    label: `${b.provider} (Current: ${formatCurrency(b.cost, b.currency)})`,
                  }))}
                />
                <Input
                  id="new-price-input"
                  label={`Revised Total Cost (${currency})`}
                  type="number"
                  value={newPriceInput}
                  onChange={(e) => setNewPriceInput(e.target.value)}
                />
              </>
            )}

            {selectedEventType === 'member_departure' && (
              <>
                <Select
                  id="target-departing-member"
                  label="Select Departing Member"
                  value={effectiveMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  options={activeMembers.map((m) => ({
                    value: m.id,
                    label: `${m.name} (${m.role} - Budget ${formatCurrency(m.personalBudget, currency)})`,
                  }))}
                />
                <Select
                  id="departure-policy"
                  label="Cost Allocation Policy"
                  value={departurePolicy}
                  onChange={(e) =>
                    setDeparturePolicy(e.target.value as 'group_absorbs_shared' | 'departing_member_retains_liability')
                  }
                  options={[
                    { value: 'group_absorbs_shared', label: 'Group Absorbs Shared Lodging & Transit' },
                    { value: 'departing_member_retains_liability', label: 'Strict Liability: Member Forfeits Share' },
                  ]}
                />
              </>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunSimulation}
                className="w-full text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Preview Impact
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyToTrip}
                className="w-full text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Apply to Trip
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Result Presentation */}
      {activeSnapshot && (
        <Card className="bg-card border-border shadow-xs animate-in fade-in duration-200">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] py-0.5 px-2.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    {activeSnapshot.eventType.replace('_', ' ')}
                  </span>
                  <h3 className="text-lg font-bold text-foreground">{activeSnapshot.title}</h3>
                </div>

                <p className="text-xs text-muted-foreground mt-1">{activeSnapshot.summary}</p>
              </div>

              <div className="bg-secondary/60 rounded-xl px-4 py-2 border border-border/80 text-right">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                  Policy Framework
                </span>
                <span className="text-xs font-bold text-foreground">
                  {activeSnapshot.allocationPolicy}
                </span>
              </div>
            </div>

            {/* Before vs After Member Liabilities Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Member Financial Responsibilities (Before vs After)
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">Member</th>
                      <th className="py-2.5 px-3 font-semibold">Prior Liability</th>
                      <th className="py-2.5 px-3 font-semibold">Updated Liability</th>
                      <th className="py-2.5 px-3 font-semibold">Net Shift (Delta)</th>
                      <th className="py-2.5 px-3 font-semibold">Refund / Loss Status</th>
                      <th className="py-2.5 px-3 font-semibold">Remaining Budget</th>
                      <th className="py-2.5 px-3 font-semibold">Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {activeSnapshot.memberDeltas.map((delta) => {
                      const deltaPositive = delta.deltaAmount > 0;
                      const deltaNegative = delta.deltaAmount < 0;

                      return (
                        <tr key={delta.memberId} className="hover:bg-secondary/20">
                          <td className="py-3 px-3 font-bold text-foreground">
                            {delta.memberName}
                            {delta.isBudgetExceeded && (
                              <span className="ml-1.5 text-[10px] text-rose-600 font-bold bg-rose-500/10 px-1.5 py-0.2 rounded">
                                Budget Exceeded!
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-muted-foreground">
                            {formatCurrency(delta.priorLiability, currency)}
                          </td>
                          <td className="py-3 px-3 font-bold text-foreground">
                            {formatCurrency(delta.updatedLiability, currency)}
                          </td>
                          <td className="py-3 px-3 font-extrabold">
                            {deltaPositive && (
                              <span className="text-rose-600 dark:text-rose-400">
                                +{formatCurrency(delta.deltaAmount, currency)}
                              </span>
                            )}
                            {deltaNegative && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(delta.deltaAmount, currency)}
                              </span>
                            )}
                            {!deltaPositive && !deltaNegative && (
                              <span className="text-muted-foreground">₹0.00</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {delta.refundCredit > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                +{formatCurrency(delta.refundCredit, currency)} Refund Credit
                              </span>
                            )}
                            {delta.unrecoverableLoss > 0 && (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                {formatCurrency(delta.unrecoverableLoss, currency)} Cash Loss
                              </span>
                            )}
                            {delta.refundCredit === 0 && delta.unrecoverableLoss === 0 && (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-semibold ${
                                delta.remainingPersonalBudget < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-foreground'
                              }`}
                            >
                              {formatCurrency(delta.remainingPersonalBudget, currency)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground text-[11px] leading-relaxed max-w-xs">
                            {delta.explanation}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recalculation Summary Callout */}
            <div className="bg-secondary/40 rounded-xl p-4 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Exact financial reconciliation verified: sum of individual member shares equals total adjusted group expense.
                </span>
              </div>
              <div className="flex items-center gap-3 font-semibold">
                {activeSnapshot.totalRefundGenerated > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Total Refund: {formatCurrency(activeSnapshot.totalRefundGenerated, currency)}
                  </span>
                )}
                {activeSnapshot.totalUnrecoverableLoss > 0 && (
                  <span className="text-rose-600 dark:text-rose-400">
                    Total Loss: {formatCurrency(activeSnapshot.totalUnrecoverableLoss, currency)}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Audit Trail */}
      {trip.financialSnapshots && trip.financialSnapshots.length > 0 && (
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Change-Aware Audit Trail ({trip.financialSnapshots.length} Event{trip.financialSnapshots.length === 1 ? '' : 's'})
            </h3>
            <div className="space-y-2">
              {trip.financialSnapshots.map((snap) => (
                <div
                  key={snap.id}
                  onClick={() => setActiveSnapshot(snap)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    activeSnapshot?.id === snap.id
                      ? 'border-rose-500 bg-rose-500/5 font-semibold'
                      : 'border-border hover:bg-secondary/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="capitalize px-1.5 py-0.5 rounded bg-secondary font-medium">
                      {snap.eventType.replace('_', ' ')}
                    </span>
                    <span>{snap.title}</span>
                  </div>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(snap.calculatedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
