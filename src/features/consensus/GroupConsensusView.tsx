import React, { useState } from 'react';
import { Trip } from '../../domain/trips/trip.types';
import { rankRecoveryPlansForGroup } from '../../domain/consensus/consensus.engine';
import { generateRecoveryPlans } from '../../domain/recovery/recovery.engine';
import { DEMO_RECOVERY_OPTIONS } from '../../lib/demo-data';
import { Card, CardContent } from '../../components/ui/Card';
import { formatCurrency } from '../../lib/utils';
import {
  Scale,
  Users,
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Compass,
  Award,
} from 'lucide-react';


export interface GroupConsensusViewProps {
  trip: Trip;
  onUpdateTrip?: (updated: Trip) => void;
}

export const GroupConsensusView: React.FC<GroupConsensusViewProps> = ({ trip }) => {
  const members = trip.members || [];
  const currency = trip.bookings[0]?.currency || 'INR';

  // Generate candidate recovery plans from demo options or existing bookings
  const rawRecoveryPlans = generateRecoveryPlans(
    trip,
    null,
    DEMO_RECOVERY_OPTIONS,
    { priority: 'preserve-activity' }
  );

  const rankedPlans = rankRecoveryPlansForGroup(rawRecoveryPlans, trip.bookings, members);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    rankedPlans[0]?.plan.id || 'plan-1'
  );

  const activeRankedItem = rankedPlans.find((r) => r.plan.id === selectedPlanId) || rankedPlans[0];

  return (
    <div className="space-y-8">
      {/* Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 sm:p-8 text-white shadow-sm border border-slate-800">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-semibold backdrop-blur-sm border border-white/10">
            <Scale className="w-3.5 h-3.5" />
            <span>Final X-Factor — Change-Aware Group Consensus Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Group Preference Balancing & Smart Alternatives
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Balances individual member travel priorities, cost sensitivities, and personal budget ceilings to objectively score candidate itineraries and highlight trade-offs.
          </p>
        </div>
      </div>

      {/* Member Preference Profiles Overview */}
      <Card className="bg-card border-border shadow-xs">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-500" />
                Group Preference Profiles ({members.length} Members)
              </h2>
              <p className="text-xs text-muted-foreground">
                Each member has distinct interests, budget ceilings, and trade-off willingness.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {members.map((m) => (
              <div key={m.id} className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{m.name}</span>
                  <span className="text-[10px] py-0.5 px-2 rounded-full font-semibold uppercase tracking-wider bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                    {m.preferences.costSensitivity}
                  </span>
                </div>

                <div className="text-[11px] space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Budget Limit:</span>
                    <span className="font-semibold text-foreground">{formatCurrency(m.personalBudget, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Priority:</span>
                    <span className="capitalize font-medium text-foreground">
                      {m.preferences.priority.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pace:</span>
                    <span className="capitalize font-medium text-foreground">{m.preferences.preferredPace}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-border/60">
                  <span className="text-[10px] text-muted-foreground block mb-1">Interests:</span>
                  <div className="flex flex-wrap gap-1">
                    {m.preferences.activityInterests.map((interest) => (
                      <span key={interest} className="text-[9px] px-1.5 py-0.2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded font-medium capitalize">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Candidate Alternatives Comparison */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-500" />
            Candidate Itinerary Alternatives & Consensus Ranking
          </h2>
          <p className="text-xs text-muted-foreground">
            Ranked deterministically by consensus score, fairness index, and 100% budget feasibility across all members.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rankedPlans.map(({ plan, consensus }) => {
            const isSelected = plan.id === selectedPlanId;
            const isRank1 = consensus.rank === 1;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-4 ${
                  isSelected
                    ? 'border-teal-500 bg-teal-500/5 ring-2 ring-teal-500/20 shadow-sm'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[11px] font-bold">
                        #{consensus.rank}
                      </span>
                      <h3 className="font-bold text-sm text-foreground">{plan.name}</h3>
                      {isRank1 && (
                        <span className="text-[10px] py-0.5 px-2 rounded-full font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Award className="w-3 h-3 inline" /> Consensus Winner
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {plan.description}
                    </p>
                  </div>

                  {/* Consensus Score Dial */}
                  <div className="text-right shrink-0">
                    <div className="inline-flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-teal-600/10 border border-teal-600/20 text-teal-700 dark:text-teal-300">
                      <span className="text-lg font-extrabold leading-none">{consensus.overallScore}</span>
                      <span className="text-[9px] font-semibold uppercase">Score</span>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown Pills */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Fairness</span>
                    <span className="font-bold text-foreground">{consensus.fairnessIndex}/100</span>
                  </div>

                  <div className="p-2 rounded-lg bg-secondary/50 border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Extra Spend</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(plan.additionalSpending, plan.currency)}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-secondary/50 border border-border/60">
                    <span className="text-[10px] text-muted-foreground block">Budget Check</span>
                    <span className={`font-bold ${consensus.allMembersWithinBudget ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {consensus.allMembersWithinBudget ? '100% Feasible' : 'Budget Breach'}
                    </span>
                  </div>
                </div>

                {/* Trade-off summary */}
                <div className="text-xs bg-secondary/30 rounded-xl p-3 text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground block mb-0.5">Trade-off Analysis:</span>
                  {consensus.tradeOffSummary}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Alternative Deep-Dive */}
      {activeRankedItem && (
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider block">
                  Detailed Consensus Breakdown
                </span>
                <h3 className="text-xl font-bold text-foreground">{activeRankedItem.plan.name}</h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Out-of-Pocket Extra</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatCurrency(activeRankedItem.plan.additionalSpending, activeRankedItem.plan.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual Member Evaluations Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Individual Member Satisfaction & Feasibility
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">Member</th>
                      <th className="py-2.5 px-3 font-semibold">Satisfaction</th>
                      <th className="py-2.5 px-3 font-semibold">Activity Match</th>
                      <th className="py-2.5 px-3 font-semibold">Cost Friendliness</th>
                      <th className="py-2.5 px-3 font-semibold">Allocated Cost</th>
                      <th className="py-2.5 px-3 font-semibold">Personal Budget</th>
                      <th className="py-2.5 px-3 font-semibold">Budget Feasibility</th>
                      <th className="py-2.5 px-3 font-semibold">Individual Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {activeRankedItem.consensus.memberEvaluations.map((evalItem) => (
                      <tr key={evalItem.memberId} className="hover:bg-secondary/20">
                        <td className="py-3 px-3 font-bold text-foreground">{evalItem.memberName}</td>
                        <td className="py-3 px-3">
                          <span className="font-extrabold text-sm text-teal-600 dark:text-teal-400">
                            {evalItem.satisfactionScore}%
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-foreground">{evalItem.activityMatchScore}%</td>
                        <td className="py-3 px-3 font-semibold text-foreground">{evalItem.costSatisfactionScore}%</td>
                        <td className="py-3 px-3 font-bold text-foreground">
                          {formatCurrency(evalItem.allocatedCost, currency)}
                        </td>
                        <td className="py-3 px-3 font-medium text-muted-foreground">
                          {formatCurrency(evalItem.personalBudget, currency)}
                        </td>
                        <td className="py-3 px-3">
                          {evalItem.isBudgetFeasible ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Within Limit
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> +{evalItem.budgetOverrunAmount} Overrun!
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                          {evalItem.individualFeedback}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pros and Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <ThumbsUp className="w-3.5 h-3.5" /> Key Strengths
                </span>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {activeRankedItem.consensus.pros.map((pro, i) => (
                    <li key={i}>{pro}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <ThumbsDown className="w-3.5 h-3.5" /> Potential Trade-Offs & Compromises
                </span>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {activeRankedItem.consensus.cons.length > 0 ? (
                    activeRankedItem.consensus.cons.map((con, i) => <li key={i}>{con}</li>)
                  ) : (
                    <li>No major trade-offs or budget breaches detected.</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
