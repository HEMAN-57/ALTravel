import React, { useState, useMemo } from 'react';
import { Trip } from '../../domain/trips/trip.types';
import { DisruptionInput } from '../../domain/disruptions/disruption.types';
import { propagateDisruption } from '../../domain/disruptions/propagation.engine';
import {
  RecoveryOption,
  RecoveryPlan,
  RecoveryPriority,
  ActionItem,
} from '../../domain/recovery/recovery.types';
import {
  generateRecoveryPlans,
  generateActionPlan,
} from '../../domain/recovery/recovery.engine';
import {
  DEMO_RECOVERY_OPTIONS,
  DEMO_DISRUPTION,
  DEMO_TRIP_ID,
} from '../../lib/demo-data';
import { AddRecoveryOptionModal } from './AddRecoveryOptionModal';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatCurrency } from '../../lib/utils';
import {
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Plus,
  Compass,
  ListOrdered,
  Heart,
  TrendingDown,
  Info,
} from 'lucide-react';

export interface RecoveryPlannerViewProps {
  trips: Trip[];
  activeTrip: Trip | null;
  onSelectTrip: (tripId: string) => void;
  onLoadSample: () => void;
  onGoToBookings?: () => void;
}

export const RecoveryPlannerView: React.FC<RecoveryPlannerViewProps> = ({
  trips,
  activeTrip,
  onSelectTrip,
  onLoadSample,
  onGoToBookings,
}) => {
  // Synchronous trip tracking to prevent any transient render with stale state
  const [prevTripId, setPrevTripId] = useState<string | undefined>(activeTrip?.id);
  const [completedActionKeys, setCompletedActionKeys] = useState<Record<string, boolean>>({});
  const [selectedPlanIdByTrip, setSelectedPlanIdByTrip] = useState<Record<string, string | null>>({});
  const [customOptionsByTrip, setCustomOptionsByTrip] = useState<Record<string, RecoveryOption[]>>({});
  const [selectedBookingIdByTrip, setSelectedBookingIdByTrip] = useState<Record<string, string>>({});
  const [criticalBookingIdsByTrip, setCriticalBookingIdsByTrip] = useState<Record<string, string[]>>({});

  // Synchronously reset completion state when activeTrip changes
  if (activeTrip?.id !== prevTripId) {
    setPrevTripId(activeTrip?.id);
    setCompletedActionKeys({});
  }

  // Disruption inputs (type, duration, recorded)
  const [disruptionType, setDisruptionType] = useState<'delay' | 'cancellation'>('delay');
  const [delayMinutes, setDelayMinutes] = useState<string>('240'); // Default 4-hour delay
  const [disruptionRecorded, setDisruptionRecorded] = useState<boolean>(true);
  const [isAddOptionOpen, setIsAddOptionOpen] = useState<boolean>(false);

  // Recovery constraints & priority
  const [priority, setPriority] = useState<RecoveryPriority>('preserve-activity');
  const [maxBudget, setMaxBudget] = useState<string>('');
  const [experienceValue, setExperienceValue] = useState<string>('85'); // Default activity rating

  // Derived: Selected booking strictly validated against activeTrip's current bookings
  const selectedBookingId = useMemo(() => {
    if (!activeTrip || activeTrip.bookings.length === 0) return '';
    const chosen = selectedBookingIdByTrip[activeTrip.id];
    if (chosen && activeTrip.bookings.some((b) => b.id === chosen)) {
      return chosen;
    }
    // Default for demo trip: demo flight if present
    if (activeTrip.id === DEMO_TRIP_ID && activeTrip.bookings.some((b) => b.id === 'demo-booking-flight-1')) {
      return 'demo-booking-flight-1';
    }
    // Default for any trip: first booking
    return activeTrip.bookings[0]?.id || '';
  }, [activeTrip, selectedBookingIdByTrip]);

  // Derived: Candidate recovery options scoped strictly to activeTrip
  const candidateOptions = useMemo(() => {
    if (!activeTrip || activeTrip.bookings.length === 0) return [];
    const base = activeTrip.id === DEMO_TRIP_ID ? (DEMO_RECOVERY_OPTIONS as RecoveryOption[]) : [];
    const custom = customOptionsByTrip[activeTrip.id] || [];
    const all = [...base, ...custom];
    const tripBookingIds = new Set(activeTrip.bookings.map((b) => b.id));
    const optionIds = new Set(all.map((o) => o.id));

    // Ensure every recovery option belongs to activeTrip and targets a valid booking of activeTrip or primary option
    return all.filter(
      (opt) =>
        opt.tripId === activeTrip.id &&
        (tripBookingIds.has(opt.targetBookingId) || optionIds.has(opt.targetBookingId))
    );
  }, [activeTrip, customOptionsByTrip]);

  // Derived: Critical booking IDs scoped strictly to activeTrip
  const criticalBookingIds = useMemo(() => {
    if (!activeTrip || activeTrip.bookings.length === 0) return [];
    const tripBookingIds = new Set(activeTrip.bookings.map((b) => b.id));
    const customChoice = criticalBookingIdsByTrip[activeTrip.id];
    if (customChoice !== undefined) {
      return customChoice.filter((id) => tripBookingIds.has(id));
    }
    if (activeTrip.id === DEMO_TRIP_ID && tripBookingIds.has('demo-booking-scuba-1')) {
      return ['demo-booking-scuba-1'];
    }
    return [];
  }, [activeTrip, criticalBookingIdsByTrip]);

  // Evaluate disruption propagation
  const disruptionInput: DisruptionInput | null = useMemo(() => {
    if (!disruptionRecorded || !selectedBookingId || !activeTrip) return null;
    const exists = activeTrip.bookings.some((b) => b.id === selectedBookingId);
    if (!exists) return null;

    if (disruptionType === 'cancellation') {
      return {
        type: 'cancellation',
        targetBookingId: selectedBookingId,
      };
    }
    return {
      type: 'delay',
      targetBookingId: selectedBookingId,
      delayMinutes: Math.max(0, parseInt(delayMinutes, 10) || 0),
    };
  }, [disruptionRecorded, selectedBookingId, activeTrip, disruptionType, delayMinutes]);

  const disruptionResult = useMemo(() => {
    if (!activeTrip || !disruptionInput) return null;
    return propagateDisruption(activeTrip, disruptionInput);
  }, [activeTrip, disruptionInput]);

  // Generate candidate recovery plans
  const evaluatedPlans = useMemo(() => {
    if (!activeTrip || activeTrip.bookings.length === 0 || candidateOptions.length === 0) return [];

    const budgetNum = maxBudget.trim() !== '' ? parseFloat(maxBudget) : undefined;
    const expNum = experienceValue.trim() !== '' ? parseFloat(experienceValue) : 0;

    const expMap: Record<string, number> = {};
    if (expNum > 0) {
      const activity = activeTrip.bookings.find((b) => b.type === 'activity');
      if (activity) {
        expMap[activity.id] = expNum;
      }
    }

    return generateRecoveryPlans(
      activeTrip,
      disruptionResult,
      candidateOptions,
      {
        priority,
        maxBudget: budgetNum,
        criticalBookingIds,
        experienceValuePerBooking: expMap,
      }
    );
  }, [activeTrip, disruptionResult, candidateOptions, priority, maxBudget, experienceValue, criticalBookingIds]);

  // Selected plan and generated action plan
  const activePlan = useMemo(() => {
    if (!evaluatedPlans || evaluatedPlans.length === 0) return null;
    const preferredId = activeTrip ? selectedPlanIdByTrip[activeTrip.id] : null;
    if (preferredId) {
      const found = evaluatedPlans.find((p) => p.id === preferredId);
      if (found) return found;
    }
    return evaluatedPlans[0] || null;
  }, [evaluatedPlans, activeTrip, selectedPlanIdByTrip]);

  const actionItems: ActionItem[] = useMemo(() => {
    if (!activePlan || !activeTrip) return [];
    return generateActionPlan(activePlan, activeTrip);
  }, [activePlan, activeTrip]);

  // Stable plan/action identity key to prevent checkbox state leaks
  const getActionKey = (tripId: string, plan: RecoveryPlan, item: ActionItem) => {
    return `${tripId}:::${plan.name}:::${item.action}:::${item.provider}`;
  };

  const toggleActionComplete = (item: ActionItem) => {
    if (!activeTrip || !activePlan) return;
    const key = getActionKey(activeTrip.id, activePlan, item);
    setCompletedActionKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isActionCompleted = (item: ActionItem) => {
    if (!activeTrip || !activePlan) return false;
    const key = getActionKey(activeTrip.id, activePlan, item);
    return !!completedActionKeys[key];
  };

  const handleSelectBooking = (bookingId: string) => {
    if (!activeTrip) return;
    setSelectedBookingIdByTrip((prev) => ({
      ...prev,
      [activeTrip.id]: bookingId,
    }));
  };

  const handleToggleCritical = (bookingId: string) => {
    if (!activeTrip) return;
    setCriticalBookingIdsByTrip((prev) => {
      const current = criticalBookingIds.includes(bookingId)
        ? criticalBookingIds.filter((id) => id !== bookingId)
        : [...criticalBookingIds, bookingId];
      return {
        ...prev,
        [activeTrip.id]: current,
      };
    });
  };

  const handleSelectPlan = (planId: string) => {
    if (!activeTrip) return;
    setSelectedPlanIdByTrip((prev) => ({
      ...prev,
      [activeTrip.id]: planId,
    }));
  };

  const handleAddOption = (newOpt: RecoveryOption) => {
    if (!activeTrip) return;
    setCustomOptionsByTrip((prev) => ({
      ...prev,
      [activeTrip.id]: [...(prev[activeTrip.id] || []), newOpt],
    }));
  };

  const handleApplyDemoDisruption = () => {
    if (!activeTrip) return;
    setSelectedBookingIdByTrip((prev) => ({
      ...prev,
      [activeTrip.id]: DEMO_DISRUPTION.targetBookingId,
    }));
    setDisruptionType(DEMO_DISRUPTION.type);
    setDelayMinutes(String(DEMO_DISRUPTION.delayMinutes));
    setDisruptionRecorded(true);
    setCustomOptionsByTrip((prev) => {
      const copy = { ...prev };
      delete copy[activeTrip.id];
      return copy;
    });
    setCompletedActionKeys({});
  };

  if (!activeTrip) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <Badge variant="outline" className="text-primary border-primary/30 font-semibold text-xs">
            Milestone 3 Recovery Planning MVP
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Travel Disruption Recovery Planner
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Deterministic recovery plan comparison, feasibility enforcement, and deadline-ordered action plans.
          </p>
        </div>

        <Card className="border-dashed p-8 text-center space-y-4 bg-card/50">
          <Compass className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">No Itinerary Selected</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Select an existing trip or load the synthetic Hyderabad → Goa demonstration trip to evaluate disruption recovery options.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {trips.length > 0 && (
              <Select
                options={[
                  { value: '', label: 'Select a saved trip...' },
                  ...trips.map((t) => ({ value: t.id, label: t.name })),
                ]}
                value=""
                onChange={(e) => onSelectTrip(e.target.value)}
                className="max-w-xs text-xs"
              />
            )}
            <Button variant="primary" size="sm" onClick={onLoadSample}>
              <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
              Load Sample Trip (Hyderabad → Goa)
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Accessible empty state for itineraries without any bookings
  if (activeTrip.bookings.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6" data-testid="empty-itinerary-state">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-primary border-primary/30 font-semibold text-xs">
              Recovery Planner
            </Badge>
            {activeTrip.isSample && (
              <Badge variant="simulated" className="text-xs">
                Simulated Demonstration Itinerary
              </Badge>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Recovery Planner: {activeTrip.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTrip.origin} → {activeTrip.destination}
          </p>
        </div>

        <Card className="border-dashed p-8 text-center space-y-4 bg-card/50">
          <Compass className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-foreground">Empty Itinerary — No Bookings Available</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This itinerary currently has no bookings. At least one transport, lodging, or activity booking must be added to your trip before disruption simulation and recovery planning can proceed.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onGoToBookings ? (
              <Button variant="primary" size="sm" onClick={onGoToBookings}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Bookings to Itinerary
              </Button>
            ) : trips.length > 1 ? (
              <Select
                options={[
                  { value: '', label: 'Select another trip...' },
                  ...trips.map((t) => ({ value: t.id, label: t.name })),
                ]}
                value=""
                onChange={(e) => onSelectTrip(e.target.value)}
                className="max-w-xs text-xs"
              />
            ) : (
              <Button variant="primary" size="sm" onClick={onLoadSample}>
                <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
                Load Sample Trip (Hyderabad → Goa)
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const currency = activeTrip.bookings[0]?.currency || 'INR';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Scope & Header Banner */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-primary border-primary/30 font-semibold text-xs">
            Milestone 3 MVP
          </Badge>
          {activeTrip.isSample && (
            <Badge variant="simulated" className="text-xs">
              Simulated Demonstration Itinerary
            </Badge>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Recovery Planner: {activeTrip.name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTrip.origin} → {activeTrip.destination} • {activeTrip.bookings.length} connected bookings
            </p>
          </div>

          {activeTrip.id === DEMO_TRIP_ID && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleApplyDemoDisruption}
              className="text-xs shrink-0 bg-primary/5 hover:bg-primary/10 border-primary/30 text-primary font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Reset Demo Scenario (4h Flight Delay)
            </Button>
          )}
        </div>
      </div>

      {/* Step 1: Disruption Recorder & Impact Analysis */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Step 1: Record Disruption & Trace Downstream Consequences
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Disruption Engine Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Disrupted Leg"
              options={activeTrip.bookings.map((b) => ({
                value: b.id,
                label: `${b.type.toUpperCase()}: ${b.provider}`,
              }))}
              value={selectedBookingId}
              onChange={(e) => handleSelectBooking(e.target.value)}
            />

            <Select
              label="Disruption Type"
              options={[
                { value: 'delay', label: 'Flight / Train Delay' },
                { value: 'cancellation', label: 'Outbound Cancellation' },
              ]}
              value={disruptionType}
              onChange={(e) => setDisruptionType(e.target.value as 'delay' | 'cancellation')}
            />

            {disruptionType === 'delay' ? (
              <Input
                label="Delay Duration (Minutes)"
                type="number"
                min="0"
                step="15"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
              />
            ) : (
              <div className="flex items-end pb-1.5 text-xs text-destructive font-semibold">
                Connection severed completely
              </div>
            )}
          </div>

          {/* Downstream Impact Propagation Results */}
          {disruptionResult && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                Propagation Engine Impact Summary:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {disruptionResult.impacts.map((imp) => {
                  const b = activeTrip.bookings.find((item) => item.id === imp.bookingId);
                  const isAffected = imp.status === 'affected';
                  const isAtRisk = imp.status === 'atRisk';

                  return (
                    <div
                      key={imp.bookingId}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isAffected
                          ? 'border-destructive/30 bg-destructive/5'
                          : isAtRisk
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-emerald-500/20 bg-emerald-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground truncate">
                          {b?.provider || imp.bookingId}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isAffected
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : isAtRisk
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {imp.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {imp.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Candidate Recovery Options */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Step 2: Candidate Recovery Options
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alternative transport legs, ground transit options, or provider notifications.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddOptionOpen(true)}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Candidate Option
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-3">
          {candidateOptions.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              No candidate recovery options defined yet. Add an alternative transport or local ground option to evaluate plans.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {candidateOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="p-3.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{opt.title}</span>
                        {opt.isSimulated ? (
                          <Badge variant="simulated" className="text-[10px]">
                            Simulated Demo Data
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-sky-600 border-sky-400">
                            User Entered
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block capitalize">
                        Type: {opt.type.replace('-', ' ')}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-foreground block">
                        +{formatCurrency(opt.additionalCost, opt.currency)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {opt.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>
                      {opt.expectedArrivalTime ? (
                        <>Arrives: {new Date(opt.expectedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                      ) : (
                        'Flexible timing'
                      )}
                    </span>
                    <span className="italic">
                      {opt.deadlineType === 'user-entered' && opt.deadline
                        ? `Deadline: ${new Date(opt.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Confirm deadline with provider'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Priorities, Hard Constraints & Dimensions */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            Step 3: Recovery Priority & Explicit Constraints
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Optimization Priority (Select Decision Rule)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setPriority('minimize-cost')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  priority === 'minimize-cost'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-primary" />
                  Minimize Extra Spending
                </div>
                <span className="text-[11px] text-muted-foreground block leading-tight">
                  Prioritizes lowest out-of-pocket recovery expense.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPriority('preserve-activity')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  priority === 'preserve-activity'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground mb-1">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  Preserve Important Activity
                </div>
                <span className="text-[11px] text-muted-foreground block leading-tight">
                  Prioritizes keeping prepaid commitments and experiences intact.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPriority('earliest-arrival')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  priority === 'earliest-arrival'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs text-foreground mb-1">
                  <Clock className="w-3.5 h-3.5 text-sky-500" />
                  Arrive As Early As Possible
                </div>
                <span className="text-[11px] text-muted-foreground block leading-tight">
                  Prioritizes earliest arrival time at destination.
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <Input
              label={`Maximum Recovery Budget Cap (${currency})`}
              type="number"
              min="0"
              placeholder="e.g. 5000 (Plans exceeding this are marked infeasible)"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              hint="Hard constraint: plans exceeding this budget are marked as infeasible fallbacks"
            />

            <Input
              label="Personal Experience Value Rating (Subjective Points)"
              type="number"
              min="0"
              placeholder="e.g. 85 (Scuba diving subjective value)"
              value={experienceValue}
              onChange={(e) => setExperienceValue(e.target.value)}
              hint="Kept as a strictly separate dimension — never summed with currency"
            />
          </div>

          {/* Critical Bookings Checkboxes */}
          <div className="pt-2 border-t border-border/60 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Non-negotiable Commitments (Strict Deadlines):
            </span>
            <div className="flex flex-wrap gap-3">
              {activeTrip.bookings
                .filter((b) => b.type === 'activity' || b.type === 'hotel')
                .map((b) => (
                  <label
                    key={b.id}
                    className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer p-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60"
                  >
                    <input
                      type="checkbox"
                      checked={criticalBookingIds.includes(b.id)}
                      onChange={() => handleToggleCritical(b.id)}
                      className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>
                      {b.provider} ({b.type})
                    </span>
                  </label>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Plan Comparison & Trade-offs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-primary" />
              Step 4: Recovery Plans Comparison & Trade-offs
            </h2>
            <p className="text-xs text-muted-foreground">
              Evaluated deterministically across out-of-pocket spending, non-refundable cash loss, and preserved commitments.
            </p>
          </div>
        </div>

        {evaluatedPlans.length === 0 ? (
          <Card className="p-8 text-center text-xs text-muted-foreground">
            No candidate plans generated. Add recovery options to see comparisons.
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {evaluatedPlans.map((plan) => {
              const isSelected = activePlan?.id === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-5 transition-all flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/40 bg-card shadow-md'
                      : 'border-border bg-card/70 hover:border-border/80 shadow-sm'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Badges row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {plan.isRecommended && (
                          <Badge variant="confirmed" className="bg-emerald-600 text-white font-bold text-xs">
                            Recommended Plan
                          </Badge>
                        )}
                        {!plan.isFeasible ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Infeasible Fallback
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                            Feasible
                          </Badge>
                        )}
                      </div>

                      {plan.estimatedArrivalAtDestination && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Arrival:{' '}
                          {new Date(plan.estimatedArrivalAtDestination).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>

                    {/* Plan Title & Recommendation Reason */}
                    <div>
                      <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    {plan.recommendationReason && (
                      <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-foreground font-medium flex items-start gap-2">
                        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{plan.recommendationReason}</span>
                      </div>
                    )}

                    {!plan.isFeasible && plan.infeasibilityReasons.length > 0 && (
                      <Alert variant="destructive" className="py-2 text-xs">
                        {plan.infeasibilityReasons.join(' ')}
                      </Alert>
                    )}

                    {/* Independent Cost & Loss Metrics (STRICTLY SEPARATE) */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="p-2.5 rounded-xl bg-secondary/50 border border-border text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Extra Spending
                        </span>
                        <span className="text-sm font-extrabold text-foreground">
                          {formatCurrency(plan.additionalSpending, plan.currency)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-secondary/50 border border-border text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Cash Loss
                        </span>
                        <span className={`text-sm font-extrabold ${plan.nonRefundableCashLoss > 0 ? 'text-destructive' : 'text-foreground'}`}>
                          {formatCurrency(plan.nonRefundableCashLoss, plan.currency)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-secondary/50 border border-border text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Experience Lost
                        </span>
                        <span className={`text-sm font-extrabold ${plan.experienceValueLost > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                          {plan.experienceValueLost > 0 ? `${plan.experienceValueLost} pts` : '0 pts'}
                        </span>
                      </div>
                    </div>

                    {plan.unknownRefundLoss && plan.unknownRefundLoss > 0 ? (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                        <span>Unconfirmed Cash at Risk (Unknown Refund):</span>
                        <span className="font-bold">{formatCurrency(plan.unknownRefundLoss, plan.currency)}</span>
                      </div>
                    ) : null}

                    {/* Commitments breakdown */}
                    <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                        Commitment Consequences:
                      </span>
                      <ul className="space-y-1">
                        {plan.commitments.map((comm) => (
                          <li
                            key={comm.bookingId}
                            className="flex items-center justify-between text-xs py-0.5"
                          >
                            <span className="text-foreground">{comm.bookingTitle}:</span>
                            {comm.status === 'preserved' ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                Preserved
                              </span>
                            ) : comm.status === 'unknown' ? (
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                Uncertain ({comm.reason.split('(')[0]?.trim() || 'Unknown'})
                              </span>
                            ) : (
                              <span className="text-destructive font-semibold">
                                Forfeited ({comm.refundStatus === 'unknown' ? 'Refund Unconfirmed' : comm.reason.split('(')[0]?.trim() || 'Missed'})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Assumptions & Unknowns */}
                    {plan.assumptionsAndUnknowns.length > 0 && (
                      <div className="text-[11px] text-muted-foreground bg-secondary/30 p-2.5 rounded-lg border border-border/40 space-y-1">
                        <span className="font-semibold block text-foreground">Assumptions & Unknowns:</span>
                        <ul className="list-disc pl-3.5 space-y-0.5">
                          {plan.assumptionsAndUnknowns.map((asmp, idx) => (
                            <li key={idx}>{asmp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <Button
                    variant={isSelected ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleSelectPlan(plan.id)}
                    className="w-full text-xs font-semibold cursor-pointer"
                  >
                    {isSelected ? 'Active Plan (Viewing Action List)' : 'Select Plan & View Action List'}
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 5: Action Plan Execution */}
      {activePlan && (
        <Card className="border border-border bg-card shadow-sm" data-testid="action-plan-checklist">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-emerald-600" />
                  Step 5: Execution Action Plan for &quot;{activePlan.name}&quot;
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ordered by prerequisites and known deadlines. Unknown deadlines require provider confirmation.
                </p>
              </div>

              <Badge variant="outline" className="text-xs">
                {actionItems.length} Sequenced Action{actionItems.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-3">
            {actionItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No specific action steps required.</p>
            ) : (
              <div className="space-y-2.5">
                {actionItems.map((item) => {
                  const isDone = isActionCompleted(item);
                  const hasUnknownDeadline = item.deadlineType === 'unknown';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                        isDone
                          ? 'border-border/60 bg-secondary/30 opacity-70'
                          : 'border-border bg-card shadow-xs'
                      }`}
                    >
                      <input
                        type="checkbox"
                        data-testid="action-checkbox"
                        checked={isDone}
                        onChange={() => toggleActionComplete(item)}
                        className="mt-1 rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                            Step {item.stepNumber}: {item.action}
                          </span>

                          <div className="text-right">
                            {hasUnknownDeadline ? (
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Confirm deadline with provider
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Cutoff: {item.deadlineDisplay}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span>Target: {item.provider}</span>
                          {item.prerequisiteStepIds.length > 0 && (
                            <span className="text-amber-800 dark:text-amber-300 font-medium">
                              Requires prior step completion
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Recovery Option Modal */}
      <AddRecoveryOptionModal
        isOpen={isAddOptionOpen}
        trip={activeTrip}
        onClose={() => setIsAddOptionOpen(false)}
        onOptionAdded={(newOpt) => {
          handleAddOption(newOpt);
        }}
      />
    </div>
  );
};
