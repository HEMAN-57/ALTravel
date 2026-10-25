import React, { useState, useEffect } from 'react';
import { Trip } from './domain/trips/trip.types';
import {
  loadTrips,
  upsertTrip,
  deleteTrip,
  loadSampleTrip,
  resetALTravelStorage,
  getActiveTripId,
  setActiveTripId,
} from './lib/storage';
import { AppShell } from './components/layout/AppShell';
import { NavTab } from './components/layout/Navbar';
import { TripCard } from './features/trips/TripCard';
import { TripDetailView } from './features/trips/TripDetailView';
import { EmptyState } from './features/trips/EmptyState';
import { CreateTripModal } from './features/trips/CreateTripModal';
import { RecoveryPlannerView } from './features/recovery/RecoveryPlannerView';
import { Button } from './components/ui/Button';
import { Card, CardContent } from './components/ui/Card';
import { Alert } from './components/ui/Alert';
import { formatCurrency } from './lib/utils';
import {
  Compass,
  Sparkles,
  Plus,
  Layers,
  ShieldCheck,
  Calendar,
  HardDrive,
} from 'lucide-react';

export const App: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripIdState] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [notification, setNotification] = useState<{
    variant: 'success' | 'info' | 'warning' | 'destructive';
    message: string;
  } | null>(null);

  // Initialize trips and selected trip from localStorage on mount
  useEffect(() => {
    const stored = loadTrips();
    setTrips(stored);
    const activeId = getActiveTripId();
    if (activeId && stored.some((t) => t.id === activeId)) {
      setSelectedTripIdState(activeId);
    } else if (stored.length > 0) {
      setSelectedTripIdState(stored[0]?.id ?? null);
    }
  }, []);

  // Sync selected trip ID with localStorage
  const handleSelectTrip = (id: string | null) => {
    setSelectedTripIdState(id);
    setActiveTripId(id);
  };

  const showNotification = (
    message: string,
    variant: 'success' | 'info' | 'warning' | 'destructive' = 'success'
  ) => {
    setNotification({ message, variant });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Actions
  const handleLoadSampleTrip = () => {
    const result = loadSampleTrip();
    if (!result.success) {
      showNotification('Failed to persist sample trip to localStorage.', 'destructive');
      setTrips(loadTrips());
      return;
    }
    const updatedList = loadTrips();
    setTrips(updatedList);
    handleSelectTrip(result.trip.id);
    showNotification('Sample trip (Hyderabad → Goa) loaded into localStorage.', 'info');
  };

  const handleTripCreated = (newTrip: Trip) => {
    const success = upsertTrip(newTrip);
    if (!success) {
      showNotification(`Failed to save trip "${newTrip.name}". Storage write unsuccessful.`, 'destructive');
      setTrips(loadTrips());
      return;
    }
    const updatedList = loadTrips();
    setTrips(updatedList);
    handleSelectTrip(newTrip.id);
    setActiveTab('trips');
    showNotification(`Trip "${newTrip.name}" created successfully.`);
  };

  const handleUpdateTrip = (updated: Trip) => {
    const success = upsertTrip(updated);
    if (!success) {
      showNotification(`Failed to update trip "${updated.name}". Changes were not saved.`, 'destructive');
      setTrips(loadTrips());
      return;
    }
    setTrips(loadTrips());
    showNotification('Trip itinerary updated.');
  };

  const handleDeleteTrip = (tripId: string) => {
    const tripToDelete = trips.find((t) => t.id === tripId);
    const success = deleteTrip(tripId);
    if (!success) {
      showNotification(`Failed to delete trip "${tripToDelete?.name || ''}".`, 'destructive');
      setTrips(loadTrips());
      return;
    }
    const updated = loadTrips();
    setTrips(updated);

    if (selectedTripId === tripId) {
      handleSelectTrip(updated[0]?.id ?? null);
    }
    showNotification(`Trip "${tripToDelete?.name || ''}" removed from storage.`, 'warning');
  };

  const handleResetStorage = () => {
    resetALTravelStorage();
    setTrips([]);
    handleSelectTrip(null);
    setActiveTab('dashboard');
    showNotification('ALTravel trip storage has been cleared.', 'info');
  };

  const activeTrip = trips.find((t) => t.id === selectedTripId) || null;

  // Aggregate stats across all trips
  const totalBookingsCount = trips.reduce((sum, t) => sum + t.bookings.length, 0);
  const totalEstimatedSpend = trips.reduce(
    (sum, t) => sum + t.bookings.reduce((bSum, b) => bSum + (b.cost || 0), 0),
    0
  );

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onCreateTrip={() => setIsCreateTripOpen(true)}
      onResetStorage={handleResetStorage}
      tripCount={trips.length}
    >
      {/* Toast Notification Banner */}
      {notification && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <Alert variant={notification.variant} className="py-2.5">
            <span className="text-xs sm:text-sm font-medium">{notification.message}</span>
          </Alert>
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Hero Welcome Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white p-6 sm:p-8 shadow-sm">
            <div className="relative z-10 max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-sky-200 text-xs font-semibold backdrop-blur-sm border border-white/10">
                <Compass className="w-3.5 h-3.5" />
                <span>Travel Disruption Protection</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                When travel goes wrong, find your next best move.
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                ALTravel models connected bookings, traces downstream consequences, and prepares you to act decisively when delays or cancellations occur.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateTripOpen(true)}
                  className="bg-sky-500 hover:bg-sky-400 text-white font-semibold"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create New Trip
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSampleTrip}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
                  Load Sample Trip (Hyderabad → Goa)
                </Button>
              </div>
            </div>

            {/* Subtle decorative background compass ring */}
            <div className="absolute -right-8 -bottom-12 opacity-10 pointer-events-none">
              <Compass className="w-72 h-72 text-white" />
            </div>
          </div>

          {/* Quick Stats Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Total Trips</span>
                  <span className="text-xl font-bold text-foreground">{trips.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Monitored Bookings</span>
                  <span className="text-xl font-bold text-foreground">{totalBookingsCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Committed Outlay</span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(totalEstimatedSpend, 'INR')}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium block">Persistence Engine</span>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    localStorage (Active)
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trips Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">
                  Your Itineraries
                </h2>
                <p className="text-xs text-muted-foreground">
                  Saved trips and simulated travel itineraries.
                </p>
              </div>

              {trips.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateTripOpen(true)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Itinerary
                </Button>
              )}
            </div>

            {trips.length === 0 ? (
              <EmptyState
                onLoadSample={handleLoadSampleTrip}
                onCreateTrip={() => setIsCreateTripOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onSelect={(id) => {
                      handleSelectTrip(id);
                      setActiveTab('trips');
                    }}
                    onDelete={handleDeleteTrip}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY TRIPS TAB */}
      {activeTab === 'trips' && (
        <div className="space-y-6">
          {trips.length === 0 ? (
            <EmptyState
              onLoadSample={handleLoadSampleTrip}
              onCreateTrip={() => setIsCreateTripOpen(true)}
            />
          ) : activeTrip ? (
            <TripDetailView
              trip={activeTrip}
              onBack={() => handleSelectTrip(null)}
              onUpdateTrip={handleUpdateTrip}
              onDeleteTrip={handleDeleteTrip}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    All Itineraries
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Select an itinerary to inspect bookings, transit times, and cancellation deadlines.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateTripOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Trip
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onSelect={handleSelectTrip}
                    onDelete={handleDeleteTrip}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RECOVERY PLANNER TAB */}
      {activeTab === 'recovery' && (
        <RecoveryPlannerView
          activeTrip={activeTrip}
          trips={trips}
          onSelectTrip={handleSelectTrip}
          onLoadSample={handleLoadSampleTrip}
        />
      )}

      {/* Create Trip Modal */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onTripCreated={handleTripCreated}
      />
    </AppShell>
  );
};

export default App;
