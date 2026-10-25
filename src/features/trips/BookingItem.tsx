import React from 'react';
import { Booking } from '../../domain/bookings/booking.types';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { Clock, MapPin, FileText, Calendar, Trash2 } from 'lucide-react';

export interface BookingItemProps {
  booking: Booking;
  onDelete?: (bookingId: string) => void;
}

export const BookingItem: React.FC<BookingItemProps> = ({ booking, onDelete }) => {
  return (
    <Card className="hover:border-primary/40 transition-all shadow-sm">
      <CardContent className="p-5 space-y-4">
        {/* Header row: Type badge, Provider, Status badge, Cost */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant={booking.type} className="capitalize font-semibold">
              {booking.type}
            </Badge>
            <h4 className="font-semibold text-base text-foreground">
              {booking.provider}
            </h4>
            {booking.confirmationReference && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/80">
                Ref: {booking.confirmationReference}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <Badge variant={booking.status} className="capitalize">
              {booking.status}
            </Badge>
            <span className="text-base font-bold text-foreground">
              {formatCurrency(booking.cost, booking.currency)}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(booking.id)}
                className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                title="Delete booking"
                aria-label={`Delete booking ${booking.provider}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Location & Time Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
          {/* Location */}
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-foreground block">Location / Route</span>
              <span>{booking.location}</span>
            </div>
          </div>

          {/* Schedule */}
          <div className="flex items-start gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-foreground block">
                {booking.type === 'hotel' ? 'Stay Duration' : 'Schedule'}
              </span>
              <span>
                {formatDateTime(booking.startTime)}
                {booking.endTime && ` → ${formatDateTime(booking.endTime)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Deadlines & Policies Section */}
        {(booking.arrivalDeadline || booking.cancellationDeadline || booking.cancellationPolicyNotes) && (
          <div className="rounded-lg bg-secondary/50 p-3 text-xs space-y-1.5 border border-border/60">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Deadlines & Cancellation Rules</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1">
              {booking.arrivalDeadline && (
                <div>
                  <span className="font-medium text-foreground block">Cutoff / Arrival Deadline:</span>
                  <span>{formatDateTime(booking.arrivalDeadline)}</span>
                </div>
              )}
              {booking.cancellationDeadline && (
                <div>
                  <span className="font-medium text-foreground block">Free/Standard Cancellation Deadline:</span>
                  <span>{formatDateTime(booking.cancellationDeadline)}</span>
                </div>
              )}
            </div>

            {booking.cancellationPolicyNotes && (
              <p className="text-[11px] text-muted-foreground italic border-t border-border/40 pt-1.5">
                {booking.cancellationPolicyNotes}
              </p>
            )}
          </div>
        )}

        {/* Notes (if present) */}
        {booking.notes && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <span>{booking.notes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
