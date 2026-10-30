import React from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Compass, Sparkles, LogIn, Plus, ShieldCheck } from 'lucide-react';

export interface EmptyStateProps {
  onLoadSample: () => void;
  onCreateTrip: () => void;
  isGuest?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onLoadSample,
  onCreateTrip,
  isGuest = false,
}) => {
  return (
    <Card className="border-dashed border-2 bg-card/60 backdrop-blur-sm max-w-2xl mx-auto my-6">
      <CardContent className="pt-8 pb-8 px-6 text-center space-y-5">
        {/* Visual Icon Badge */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
          <Compass className="h-7 w-7" />
        </div>

        {/* Text Heading & Copy */}
        <div className="space-y-2 max-w-lg mx-auto">
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            {isGuest ? 'Welcome to TripSync Guest Mode' : 'No Personal Itineraries Saved Yet'}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isGuest
              ? 'Guest mode keeps your personal travel data strictly private. Explore our simulated 4-member Goa scenario without registering, or sign in to save custom trips to your account.'
              : 'TripSync balances group preferences, personal budget constraints, and automated bill splitting while recalculating liabilities when bookings change.'}
          </p>
        </div>

        {/* Demo banner note */}
        <div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-950 dark:text-indigo-200 border border-indigo-500/20 text-xs text-left flex items-start gap-3 max-w-lg mx-auto">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <p>
            Experience our <strong>Change-Aware Group Consensus Engine</strong> with the canonical <strong>Goa Getaway (Aarav, Priya, Rohan, Ananya)</strong> featuring unequal expense splits and price disruption recalculations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <Button
            variant="primary"
            size="md"
            onClick={onLoadSample}
            className="w-full sm:w-auto shadow-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
            Load Sample Trip (4-Member Goa Demo)
          </Button>

          {isGuest ? (
            <Button
              variant="outline"
              size="md"
              onClick={onCreateTrip}
              className="w-full sm:w-auto font-medium"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In / Register
            </Button>
          ) : (
            <Button
              variant="outline"
              size="md"
              onClick={onCreateTrip}
              className="w-full sm:w-auto font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Custom Trip
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
