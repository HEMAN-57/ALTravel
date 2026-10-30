import React, { useState } from 'react';
import { Trip } from '../../domain/trips/trip.types';
import { Booking } from '../../domain/bookings/booking.types';
import { BookingItem } from './BookingItem';
import { CreateBookingModal } from './CreateBookingModal';
import { RecoveryPlannerView } from '../recovery/RecoveryPlannerView';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Alert } from '../../components/ui/Alert';
import { formatDateOnly, formatCurrency } from '../../lib/utils';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  Receipt,
  Layers,
  Plane,
  Building,
  Compass,
  Users,
} from 'lucide-react';


export interface TripDetailViewProps {
  trip: Trip;
  onBack: () => void;
  onUpdateTrip: (updated: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
}

export const TripDetailView: React.FC<TripDetailViewProps> = ({
  trip,
  onBack,
  onUpdateTrip,
  onDeleteTrip,
}) => {
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'bookings' | 'recovery'>('bookings');

  // Chronologically sort bookings by start time
  const sortedBookings = [...trip.bookings].sort(
    (a, b) => (a.startTime ? new Date(a.startTime).getTime() : 0) - (b.startTime ? new Date(b.startTime).getTime() : 0)
  );

  const totalCost = trip.bookings.reduce((sum, b) => sum + (b.cost || 0), 0);
  const currency = trip.bookings[0]?.currency || 'INR';

  const flightCount = trip.bookings.filter((b) => b.type === 'flight').length;
  const hotelCount = trip.bookings.filter((b) => b.type === 'hotel').length;
  const activityCount = trip.bookings.filter((b) => b.type === 'activity').length;

  const handleAddBooking = (newBooking: Booking) => {
    const updated: Trip = {
      ...trip,
      bookings: [...trip.bookings, newBooking],
      updatedAt: new Date().toISOString(),
    };
    onUpdateTrip(updated);
  };

  const handleDeleteBooking = (bookingId: string) => {
    const updated: Trip = {
      ...trip,
      bookings: trip.bookings.filter((b) => b.id !== bookingId),
      updatedAt: new Date().toISOString(),
    };
    onUpdateTrip(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top back & actions row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Trips</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDeleteTrip(trip.id)}
            className="text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete Trip
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddBookingOpen(true)}
            className="text-xs shadow-sm font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Booking
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <Card className="bg-card shadow-sm border border-border">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {trip.isSample && (
                  <Badge variant="simulated" className="text-xs">
                    Simulated Demo Data
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateOnly(trip.startDate)} — {formatDateOnly(trip.endDate)}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {trip.name}
              </h1>

              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span className="text-foreground">{trip.origin}</span>
                <span>→</span>
                <span className="text-foreground">{trip.destination}</span>
              </div>
            </div>

            {/* Financial summary widget */}
            <div className="bg-secondary/60 rounded-xl p-4 border border-border/80 min-w-[200px] text-right md:text-right">
              <span className="text-xs uppercase font-semibold text-muted-foreground block tracking-wider">
                Total Committed Cost
              </span>
              <span className="text-2xl font-extrabold text-foreground tracking-tight">
                {formatCurrency(totalCost, currency)}
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {trip.bookings.length} connected booking{trip.bookings.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {trip.description && (
            <p className="text-xs sm:text-sm text-muted-foreground border-t border-border/60 pt-3 leading-relaxed">
              {trip.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Simulated disclaimer alert for demo trip */}
      {trip.isSample && (
        <Alert variant="warning" title="Simulated Architectural Demonstration Data">
          This itinerary demonstrates how ALTravel models connected travel segments. All flight numbers, schedules, resort policies, and scuba activity fees are synthetic fixtures. No real bookings or reservations were made or queried.
        </Alert>
      )}

      {/* Section Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveSection('bookings')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSection === 'bookings'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Itinerary Bookings ({trip.bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('recovery')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSection === 'recovery'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Disruption Recovery Planner</span>
        </button>
      </div>

      {activeSection === 'recovery' ? (
        <RecoveryPlannerView
          trips={[trip]}
          activeTrip={trip}
          onSelectTrip={() => {}}
          onLoadSample={() => {}}
          onGoToBookings={() => setActiveSection('bookings')}
        />
      ) : (
        <>
          {/* Quick stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Total Bookings</span>
                <span className="text-lg font-bold text-foreground">{trip.bookings.length}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
                <Plane className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Flights</span>
                <span className="text-lg font-bold text-foreground">{flightCount}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Hotels</span>
                <span className="text-lg font-bold text-foreground">{hotelCount}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Activities</span>
                <span className="text-lg font-bold text-foreground">{activityCount}</span>
              </div>
            </div>
          </div>

          {/* Trip Members & Personalised Profiles */}
          {trip.members && trip.members.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Trip Travelers & Personalized Budgets ({trip.members.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Personalized preferences and budget ceilings for each group member.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {trip.members.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground">{m.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-secondary text-muted-foreground">
                        {m.role}
                      </span>
                    </div>

                    <div className="text-[11px] space-y-1 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Personal Budget:</span>
                        <span className="font-semibold text-foreground">{formatCurrency(m.personalBudget, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pace / Style:</span>
                        <span className="capitalize text-foreground font-medium">{m.preferences.preferredPace} · {m.preferences.costSensitivity}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                      {m.preferences.activityInterests.map((interest) => (
                        <span key={interest} className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 capitalize">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bookings Timeline Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-foreground tracking-tight">
                  Connected Bookings & Itinerary Segments
                </h2>
                <p className="text-xs text-muted-foreground">
                  Ordered chronologically by start / departure time.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddBookingOpen(true)}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Segment
              </Button>
            </div>

            {sortedBookings.length === 0 ? (
              <Card className="border-dashed bg-card/40 p-8 text-center space-y-3">
                <Receipt className="w-8 h-8 text-muted-foreground mx-auto" />
                <h4 className="text-base font-semibold text-foreground">No bookings added yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Add your outbound flight, train ticket, hotel stay, or prepaid activities to begin modelling connection deadlines.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddBookingOpen(true)}
                  className="mt-2"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add First Booking
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {sortedBookings.map((b) => (
                  <BookingItem
                    key={b.id}
                    booking={b}
                    members={trip.members}
                    onDelete={handleDeleteBooking}
                  />
                ))}
              </div>
            )}
          </div>

        </>
      )}

      {/* Add Booking Modal Dialog */}
      <CreateBookingModal
        isOpen={isAddBookingOpen}
        tripId={trip.id}
        onClose={() => setIsAddBookingOpen(false)}
        onBookingCreated={handleAddBooking}
      />
    </div>
  );
};
