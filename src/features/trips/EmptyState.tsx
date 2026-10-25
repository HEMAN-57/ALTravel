import React from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Compass, Sparkles, Plus, ShieldAlert } from 'lucide-react';

export interface EmptyStateProps {
  onLoadSample: () => void;
  onCreateTrip: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onLoadSample,
  onCreateTrip,
}) => {
  return (
    <Card className="border-dashed border-2 bg-card/60 backdrop-blur-sm max-w-2xl mx-auto my-8">
      <CardContent className="pt-10 pb-10 px-6 text-center space-y-6">
        {/* Visual Icon Badge */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
          <Compass className="h-8 w-8" />
        </div>

        {/* Text Heading & Copy */}
        <div className="space-y-2 max-w-lg mx-auto">
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            No Trips in Local Storage Yet
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ALTravel models your connected flights, trains, hotels, and activities to protect your itinerary from cascading travel disruptions.
          </p>
        </div>

        {/* Demo banner note */}
        <div className="p-3.5 rounded-lg bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 text-xs text-left flex items-start gap-3 max-w-lg mx-auto">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p>
            To evaluate the application immediately without typing manual records, load the verified <strong>Hyderabad → Goa</strong> sample trip containing simulated flights, hotels, and prepaid activities.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="md"
            onClick={onLoadSample}
            className="w-full sm:w-auto shadow-sm font-semibold"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Load Sample Trip (Hyderabad → Goa)
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={onCreateTrip}
            className="w-full sm:w-auto font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Empty Trip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
