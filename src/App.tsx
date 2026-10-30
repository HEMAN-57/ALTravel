import React, { useState, useEffect } from 'react';
import { Trip } from './domain/trips/trip.types';
import {
  loadTrips,
  upsertTrip,
  deleteTrip,
  loadSampleTrip,
  resetTripSyncStorage,
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
import { GroupLedgerView } from './features/ledger/GroupLedgerView';
import { ChangeAwareRecalculationView } from './features/recalculation/ChangeAwareRecalculationView';
import { GroupConsensusView } from './features/consensus/GroupConsensusView';
import { AlertsCenterView } from './features/alerts/AlertsCenterView';
import { SAMPLE_TRIP, DEMO_TRIP_ID } from './lib/demo-data';
import { Button } from './components/ui/Button';
import { Card, CardContent } from './components/ui/Card';
import { Alert } from './components/ui/Alert';
import { formatCurrency } from './lib/utils';
import { apiClient } from './lib/api-client';
import { AuthProvider, useAuth } from './domain/auth/auth.context';
import { LoginView } from './features/auth/LoginView';
import { SignupView } from './features/auth/SignupView';
import { UserProfileView } from './features/auth/UserProfileView';
import { TripWizardView } from './features/trips/TripWizardView';
import {
  Compass,
  Sparkles,
  Plus,
  Layers,
  ShieldCheck,
  Calendar,
  HardDrive,
  Wallet,
  Scale,
  RefreshCw,
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [personalTrips, setPersonalTrips] = useState<Trip[]>([]);
  const [demoTrip, setDemoTrip] = useState<Trip | null>(null);
  const [selectedTripId, setSelectedTripIdState] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [notification, setNotification] = useState<{
    variant: 'success' | 'info' | 'warning' | 'destructive';
    message: string;
  } | null>(null);

  // Proactively ping backend health on initial load to awaken sleeping free cloud instances
  useEffect(() => {
    apiClient.pingHealth().catch(() => {});
  }, []);

  // Synchronize trip state strictly based on authentication boundaries
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      const stored = loadTrips(user.id);
      setPersonalTrips(stored);
      const activeId = getActiveTripId(user.id);
      if (activeId === DEMO_TRIP_ID) {
        setSelectedTripIdState(DEMO_TRIP_ID);
        setDemoTrip(SAMPLE_TRIP);
      } else if (activeId && stored.some((t) => t.id === activeId)) {
        setSelectedTripIdState(activeId);
      } else if (stored.length > 0) {
        setSelectedTripIdState(stored[0]?.id ?? null);
      } else {
        setSelectedTripIdState(null);
      }
    } else {
      // Guest mode: strictly zero personal trips loaded from storage
      setPersonalTrips([]);
      const guestActiveId = getActiveTripId(null);
      if (guestActiveId === DEMO_TRIP_ID) {
        setDemoTrip(SAMPLE_TRIP);
        setSelectedTripIdState(DEMO_TRIP_ID);
      } else {
        setSelectedTripIdState(null);
      }
    }
  }, [isAuthenticated, user?.id]);

  // Sync selected trip ID with user-scoped storage
  const handleSelectTrip = (id: string | null) => {
    setSelectedTripIdState(id);
    setActiveTripId(id, isAuthenticated && user?.id ? user.id : null);
    if (id === DEMO_TRIP_ID) {
      setDemoTrip(SAMPLE_TRIP);
    }
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
    const result = loadSampleTrip(isAuthenticated && user?.id ? user.id : undefined);
    if (!result.success) {
      showNotification('Failed to persist sample trip to localStorage.', 'destructive');
      return;
    }
    setDemoTrip(SAMPLE_TRIP);
    handleSelectTrip(DEMO_TRIP_ID);
    showNotification('Sample trip (Hyderabad → Goa) loaded into localStorage.', 'info');
  };

  const handleTripCreated = (newTrip: Trip) => {
    if (isAuthenticated && user?.id) {
      newTrip.userId = user.id;
    }
    const effectiveUserId = isAuthenticated && user?.id ? user.id : undefined;
    const success = upsertTrip(newTrip, effectiveUserId);
    if (!success) {
      showNotification(`Failed to save trip "${newTrip.name}". Storage write unsuccessful.`, 'destructive');
      return;
    }
    if (effectiveUserId) {
      const updatedList = loadTrips(effectiveUserId);
      setPersonalTrips(updatedList);
    } else {
      setPersonalTrips([newTrip]);
    }
    handleSelectTrip(newTrip.id);
    setActiveTab('trips');
    showNotification(`Trip "${newTrip.name}" created successfully.`);
  };

  const handleUpdateTrip = (updated: Trip) => {
    if (updated.id === DEMO_TRIP_ID || updated.isSample) {
      setDemoTrip(updated);
      const effectiveUserId = isAuthenticated && user?.id ? user.id : undefined;
      upsertTrip(updated, effectiveUserId);
      showNotification('Simulated demo itinerary updated.');
      return;
    }
    if (isAuthenticated && user?.id) {
      upsertTrip(updated, user.id);
      setPersonalTrips(loadTrips(user.id));
      showNotification('Trip itinerary updated.');
    } else {
      setPersonalTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showNotification('Trip itinerary updated.');
    }
  };

  const handleDeleteTrip = (tripId: string) => {
    const tripToDelete = personalTrips.find((t) => t.id === tripId) || (demoTrip?.id === tripId ? demoTrip : null);
    const effectiveUserId = isAuthenticated && user?.id ? user.id : undefined;
    const success = deleteTrip(tripId, effectiveUserId);
    if (!success) {
      showNotification(`Failed to delete trip "${tripToDelete?.name || ''}".`, 'destructive');
      return;
    }
    if (tripId === DEMO_TRIP_ID) {
      setDemoTrip(null);
    }
    if (effectiveUserId) {
      const updated = loadTrips(effectiveUserId);
      setPersonalTrips(updated);
    } else {
      setPersonalTrips((prev) => prev.filter((t) => t.id !== tripId));
    }
    if (selectedTripId === tripId) {
      handleSelectTrip(null);
    }
    showNotification(`Trip "${tripToDelete?.name || ''}" removed from storage.`, 'warning');
  };

  const handleResetStorage = () => {
    resetTripSyncStorage();
    setPersonalTrips([]);
    setDemoTrip(null);
    handleSelectTrip(null);
    setActiveTab('dashboard');
    showNotification('TripSync storage has been reset.', 'info');
  };

  // Active trip resolution
  const activeTrip: Trip | null =
    selectedTripId === DEMO_TRIP_ID
      ? (demoTrip || SAMPLE_TRIP)
      : (personalTrips.find((t) => t.id === selectedTripId) || (demoTrip || (personalTrips[0] ?? null)));

  // User-specific statistics (strictly isolated: personal trips only when authenticated)
  const totalBookingsCount = isAuthenticated
    ? personalTrips.reduce((sum, t) => sum + t.bookings.length, 0)
    : 0;

  const totalEstimatedSpend = isAuthenticated
    ? personalTrips.reduce(
        (sum, t) => sum + t.bookings.reduce((bSum, b) => bSum + (b.cost || 0), 0),
        0
      )
    : 0;

  const allAvailableTrips = demoTrip ? [...personalTrips, demoTrip] : personalTrips;

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onCreateTrip={() => (isAuthenticated ? setIsCreateTripOpen(true) : setActiveTab('login'))}
      onResetStorage={handleResetStorage}
      tripCount={isAuthenticated ? personalTrips.length : 0}
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
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-sm border border-slate-800">
            <div className="relative z-10 max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-semibold backdrop-blur-sm border border-white/10">
                <Compass className="w-3.5 h-3.5" />
                <span>Intelligent Group Travel Planning & Expense Management</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                When group travel changes, keep every balance & preference in sync.
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                TripSync balances individual preferences and personal budget constraints while recalculating everyone's financial responsibilities whenever bookings, prices, activities, or group membership change.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateTripOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create New Trip
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('wizard')}
                  className="bg-indigo-600/30 text-white border-indigo-400/40 hover:bg-indigo-600/50 font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-1.5 text-indigo-300" />
                  Custom Trip Wizard
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSampleTrip}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20 font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
                  Load Sample Trip (4-Member Goa Demo)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('ledger')}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Wallet className="w-4 h-4 mr-1.5 text-indigo-300" />
                  Group Ledger & Splits
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('recalculation')}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5 text-rose-300" />
                  Financial Replanning (USP)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('consensus')}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  <Scale className="w-4 h-4 mr-1.5 text-teal-300" />
                  Consensus Engine (X-Factor)
                </Button>
              </div>
            </div>

            {/* Decorative background compass ring */}
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
                  <span className="text-xs text-muted-foreground font-medium block">Personal Trips</span>
                  <span className="text-xl font-bold text-foreground">
                    {isAuthenticated ? personalTrips.length : 0}
                  </span>
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
                  <span className="text-xs text-muted-foreground font-medium block">Session Mode</span>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {isAuthenticated ? `Account (${user?.email ?? 'Active'})` : 'Guest (Unauthenticated)'}
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
                  {isAuthenticated ? 'Your Personal Itineraries' : 'Itineraries & Demonstrations'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isAuthenticated
                    ? 'Saved itineraries belonging exclusively to your account.'
                    : 'Personal trips require sign in. Simulated demo is available below.'}
                </p>
              </div>

              {isAuthenticated && personalTrips.length > 0 && (
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

            {!isAuthenticated ? (
              <div className="space-y-4">
                <EmptyState
                  onLoadSample={handleLoadSampleTrip}
                  onCreateTrip={() => setActiveTab('login')}
                  isGuest={true}
                />
                {demoTrip && (
                  <div className="pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <Sparkles className="w-3 h-3" />
                          Simulated Demonstration (Active)
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Simulated demo data — not saved to any personal account
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleSelectTrip(demoTrip.id);
                          setActiveTab('trips');
                        }}
                        className="text-xs"
                      >
                        Open Demo Workspace
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <TripCard
                        trip={demoTrip}
                        onSelect={(id) => {
                          handleSelectTrip(id);
                          setActiveTab('trips');
                        }}
                        onDelete={handleDeleteTrip}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : personalTrips.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  onLoadSample={handleLoadSampleTrip}
                  onCreateTrip={() => setIsCreateTripOpen(true)}
                  isGuest={false}
                />
                {demoTrip && (
                  <div className="pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        <Sparkles className="w-3 h-3" />
                        Simulated Demonstration (Separated from personal itineraries)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <TripCard
                        trip={demoTrip}
                        onSelect={(id) => {
                          handleSelectTrip(id);
                          setActiveTab('trips');
                        }}
                        onDelete={handleDeleteTrip}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalTrips.map((trip) => (
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

                {demoTrip && (
                  <div className="pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        <Sparkles className="w-3 h-3" />
                        Simulated Demonstration (Separated from personal itineraries)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <TripCard
                        trip={demoTrip}
                        onSelect={(id) => {
                          handleSelectTrip(id);
                          setActiveTab('trips');
                        }}
                        onDelete={handleDeleteTrip}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MY TRIPS TAB (ITINERARY DETAILS) */}
      {activeTab === 'trips' && (
        <div className="space-y-6">
          {activeTrip ? (
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
                {isAuthenticated && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateTripOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Trip
                  </Button>
                )}
              </div>

              {allAvailableTrips.length === 0 ? (
                <EmptyState
                  onLoadSample={handleLoadSampleTrip}
                  onCreateTrip={() => (isAuthenticated ? setIsCreateTripOpen(true) : setActiveTab('login'))}
                  isGuest={!isAuthenticated}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allAvailableTrips.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      onSelect={handleSelectTrip}
                      onDelete={handleDeleteTrip}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* GROUP LEDGER & SMART BUDGET TAB */}
      {activeTab === 'ledger' && (
        <GroupLedgerView
          trip={activeTrip || SAMPLE_TRIP}
          onUpdateTrip={handleUpdateTrip}
        />
      )}

      {/* CHANGE-AWARE FINANCIAL REPLANNING (USP) TAB */}
      {activeTab === 'recalculation' && (
        <ChangeAwareRecalculationView
          trip={activeTrip || SAMPLE_TRIP}
          onUpdateTrip={handleUpdateTrip}
        />
      )}

      {/* GROUP CONSENSUS ENGINE (X-FACTOR) TAB */}
      {activeTab === 'consensus' && (
        <GroupConsensusView
          trip={activeTrip || SAMPLE_TRIP}
          onUpdateTrip={handleUpdateTrip}
        />
      )}

      {/* ALERTS & NOTIFICATIONS TAB */}
      {activeTab === 'alerts' && (
        <AlertsCenterView trip={activeTrip || SAMPLE_TRIP} />
      )}

      {/* RECOVERY PLANNER TAB */}
      {activeTab === 'recovery' && (
        <RecoveryPlannerView
          activeTrip={activeTrip}
          trips={allAvailableTrips.length > 0 ? allAvailableTrips : [SAMPLE_TRIP]}
          onSelectTrip={handleSelectTrip}
          onLoadSample={handleLoadSampleTrip}
          onGoToBookings={() => setActiveTab('trips')}
        />
      )}

      {/* USER PROFILE TAB */}
      {activeTab === 'profile' && <UserProfileView />}

      {/* LOGIN TAB */}
      {activeTab === 'login' && (
        <LoginView
          onSuccess={() => {
            setActiveTab('dashboard');
            showNotification('Signed in successfully.');
          }}
          onNavigateToSignup={() => setActiveTab('signup')}
          onExploreDemo={handleLoadSampleTrip}
        />
      )}

      {/* SIGNUP TAB */}
      {activeTab === 'signup' && (
        <SignupView
          onSuccess={() => {
            setActiveTab('dashboard');
            showNotification('Account created successfully. Welcome to TripSync!');
          }}
          onNavigateToLogin={() => setActiveTab('login')}
          onExploreDemo={handleLoadSampleTrip}
        />
      )}

      {/* CUSTOM TRIP CREATION WIZARD TAB */}
      {activeTab === 'wizard' && (
        <TripWizardView
          onComplete={(newTrip) => {
            handleTripCreated(newTrip);
            handleSelectTrip(newTrip.id);
            setActiveTab('trips');
            showNotification(`Trip "${newTrip.name}" created with ${newTrip.members?.length || 0} travelers!`);
          }}
          onCancel={() => setActiveTab('dashboard')}
        />
      )}

      {/* Create Trip Modal */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onTripCreated={handleTripCreated}
        onLaunchWizard={() => {
          setIsCreateTripOpen(false);
          setActiveTab('wizard');
        }}
      />
    </AppShell>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
