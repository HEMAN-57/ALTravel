import React from 'react';
import { Trip } from '../../domain/trips/trip.types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDateOnly, formatCurrency } from '../../lib/utils';
import { ArrowRight, Calendar, MapPin, Trash2, ArrowUpRight } from 'lucide-react';

export interface TripCardProps {
  trip: Trip;
  onSelect: (tripId: string) => void;
  onDelete?: (tripId: string) => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onSelect, onDelete }) => {
  const totalCost = trip.bookings.reduce((sum, b) => sum + (b.cost || 0), 0);
  const currency = trip.bookings[0]?.currency || 'INR';

  const flightCount = trip.bookings.filter((b) => b.type === 'flight').length;
  const trainCount = trip.bookings.filter((b) => b.type === 'train').length;
  const hotelCount = trip.bookings.filter((b) => b.type === 'hotel').length;
  const activityCount = trip.bookings.filter((b) => b.type === 'activity').length;

  return (
    <Card className="hover:shadow-md transition-all border border-card-border hover:border-primary/50 flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {trip.isSample && (
                  <Badge variant="simulated" className="text-[10px] font-semibold">
                    Simulated Demo
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateOnly(trip.startDate)} — {formatDateOnly(trip.endDate)}
                </span>
              </div>
              <CardTitle className="text-base sm:text-lg line-clamp-1">
                {trip.name}
              </CardTitle>
            </div>

            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(trip.id);
                }}
                className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                title="Delete Trip"
                aria-label={`Delete trip ${trip.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Origin & Destination */}
          <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-secondary/40 p-2.5 rounded-lg">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span>{trip.origin}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{trip.destination}</span>
          </div>

          {/* Bookings breakdown */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Bookings ({trip.bookings.length})</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(totalCost, currency)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {flightCount > 0 && (
                <Badge variant="flight" className="text-[11px] py-0 px-2">
                  {flightCount} flight{flightCount > 1 ? 's' : ''}
                </Badge>
              )}
              {trainCount > 0 && (
                <Badge variant="train" className="text-[11px] py-0 px-2">
                  {trainCount} train{trainCount > 1 ? 's' : ''}
                </Badge>
              )}
              {hotelCount > 0 && (
                <Badge variant="hotel" className="text-[11px] py-0 px-2">
                  {hotelCount} hotel{hotelCount > 1 ? 's' : ''}
                </Badge>
              )}
              {activityCount > 0 && (
                <Badge variant="activity" className="text-[11px] py-0 px-2">
                  {activityCount} activity{activityCount > 1 ? 'ies' : ''}
                </Badge>
              )}
              {trip.bookings.length === 0 && (
                <span className="text-muted-foreground italic text-xs">No bookings attached yet</span>
              )}
            </div>
          </div>
        </CardContent>
      </div>

      <CardFooter className="pt-3 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelect(trip.id)}
          className="w-full justify-between group"
        >
          <span>View Trip Details</span>
          <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Button>
      </CardFooter>
    </Card>
  );
};
