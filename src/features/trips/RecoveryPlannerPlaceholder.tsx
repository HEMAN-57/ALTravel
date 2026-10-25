import React from 'react';
import { Trip } from '../../domain/trips/trip.types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  GitCommit,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatDateOnly } from '../../lib/utils';

export interface RecoveryPlannerPlaceholderProps {
  activeTrip: Trip | null;
  onSelectTrip: (tripId: string) => void;
  onLoadSample: () => void;
}

export const RecoveryPlannerPlaceholder: React.FC<RecoveryPlannerPlaceholderProps> = ({
  activeTrip,
  onSelectTrip,
  onLoadSample,
}) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Scope Disclaimer Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-primary border-primary/30 font-semibold text-xs">
            Milestone 2 Preview
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            Explicitly deferred per project specification
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Travel Disruption Recovery Planner
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The future recovery engine will ingest your connected itinerary, identify downstream consequences when flights or trains are delayed or cancelled, compare alternative options, and generate deadline-ordered recovery plans.
        </p>
      </div>

      {/* Planned Engine Roadmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card shadow-sm border border-border">
          <CardHeader className="pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 mb-2">
              <Layers className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm">1. Disruption Graph</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Deterministic dependency graph linking flights, transit buffers, check-in deadlines, and downstream reservations.
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border">
          <CardHeader className="pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 mb-2">
              <GitCommit className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm">2. Multi-Criteria Pareto</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Compares alternate recovery paths across time saved, incremental cost, hotel cancellation penalties, and fatigue impact.
          </CardContent>
        </Card>

        <Card className="bg-card shadow-sm border border-border">
          <CardHeader className="pb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 mb-2">
              <Clock className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm">3. Action Plan Execution</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground leading-relaxed">
            Generates clear, prioritised steps sorted by strict cancellation cutoffs to prevent financial forfeiture.
          </CardContent>
        </Card>
      </div>

      {/* Active Trip Data Preview for Milestone 2 readiness */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Itinerary Model Status for Engine Input
            </CardTitle>
            {activeTrip ? (
              <Badge variant="confirmed">Ready for Engine Evaluation</Badge>
            ) : (
              <Badge variant="pending">No Itinerary Loaded</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeTrip ? (
            <div className="p-4 rounded-xl bg-secondary/50 border border-border/80 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-base">
                      {activeTrip.name}
                    </h3>
                    {activeTrip.isSample && (
                      <Badge variant="simulated" className="text-[10px]">
                        Simulated Demo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeTrip.origin} → {activeTrip.destination} • {formatDateOnly(activeTrip.startDate)} to {formatDateOnly(activeTrip.endDate)}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectTrip(activeTrip.id)}
                  className="text-xs"
                >
                  <span>View Trip Bookings</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>

              {/* Segment checklist */}
              <div className="pt-2 border-t border-border/40 text-xs space-y-1.5">
                <span className="font-semibold text-foreground block">
                  Connected segments ready for disruption modelling ({activeTrip.bookings.length}):
                </span>
                <ul className="space-y-1">
                  {activeTrip.bookings.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="capitalize font-medium text-foreground">{b.type}:</span>
                      <span>{b.provider}</span>
                      <span className="text-xs text-muted-foreground">({b.location})</span>
                      {b.cancellationDeadline && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded border border-amber-500/20">
                          Deadline configured
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No active trip is currently selected. Load the sample Hyderabad → Goa trip or create a new trip to view its segments here.
              </p>
              <Button variant="primary" size="sm" onClick={onLoadSample}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Load Sample Trip
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
