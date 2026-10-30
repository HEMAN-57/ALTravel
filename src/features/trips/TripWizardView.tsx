import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  Users,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { Trip } from '../../domain/trips/trip.types';
import { TripMember, TravelPriority } from '../../domain/group/member.types';
import { useAuth } from '../../domain/auth/auth.context';
import { upsertTrip, setActiveTripId } from '../../lib/storage';
import { formatCurrency } from '../../lib/utils';

interface TripWizardViewProps {
  onComplete: (trip: Trip) => void;
  onCancel: () => void;
}

export const TripWizardView: React.FC<TripWizardViewProps> = ({ onComplete, onCancel }) => {
  const { user, profile } = useAuth();

  // Wizard step: 1 (Details) -> 2 (Group) -> 3 (Budget) -> 4 (Review)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Trip Details
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState(profile?.preferredCurrency || 'INR');

  // Step 2: Group Members
  // Default first member is current logged-in user or a default organizer
  const [members, setMembers] = useState<TripMember[]>([
    {
      id: user ? user.id : 'mem-organizer',
      tripId: '',
      name: user?.fullName || 'Trip Organizer',
      email: user?.email || '',
      role: 'organizer',
      status: 'active',
      personalBudget: 20000,
      preferences: {
        activityInterests: ['sightseeing', 'food', 'culture'],
        costSensitivity: profile?.costSensitivity || 'balanced',
        preferredPace: profile?.preferredPace || 'moderate',
        priority: (profile?.primaryPriority as TravelPriority) || 'preserve-activity',
        willingnessToPayExtraForSpeed: profile?.willingnessToPaySpeed ?? 0.5,
      },
    },
  ]);

  // Modal for adding/editing a member in step 2
  const [editingMember, setEditingMember] = useState<TripMember | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  // Step 3: Budget Configuration
  const [totalBudget, setTotalBudget] = useState<number>(20000);
  const [defaultSplit, setDefaultSplit] = useState<'equal' | 'participation' | 'percentage'>('equal');

  // Validation errors
  const [error, setError] = useState<string | null>(null);

  // Helper calculations
  const sumOfIndividualBudgets = members.reduce((sum, m) => sum + (m.personalBudget || 0), 0);
  const budgetDifference = totalBudget - sumOfIndividualBudgets;

  // --- Step 1 Validation & Next ---
  const handleNextFromStep1 = () => {
    setError(null);
    if (!name.trim()) {
      setError('Please provide a trip name.');
      return;
    }
    if (!origin.trim() || !destination.trim()) {
      setError('Origin and destination are required.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please select start and end dates.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be earlier than start date.');
      return;
    }
    setStep(2);
  };

  // --- Step 2 Helpers ---
  const handleOpenAddMember = () => {
    setEditingMember({
      id: `mem-${Date.now().toString(36)}`,
      tripId: '',
      name: '',
      email: '',
      role: 'member',
      status: 'active',
      personalBudget: 15000,
      preferences: {
        activityInterests: ['sightseeing', 'relaxation'],
        costSensitivity: 'balanced',
        preferredPace: 'moderate',
        priority: 'minimize-cost',
        willingnessToPayExtraForSpeed: 0.5,
      },
    });
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: TripMember) => {
    setEditingMember({ ...member });
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = (memberToSave: TripMember) => {
    if (!memberToSave.name.trim()) return;

    setMembers((prev) => {
      const idx = prev.findIndex((m) => m.id === memberToSave.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = memberToSave;
        return next;
      }
      return [...prev, memberToSave];
    });

    setIsMemberModalOpen(false);
    setEditingMember(null);
  };

  const handleRemoveMember = (id: string) => {
    if (members.length <= 1) {
      setError('A trip must have at least one traveler.');
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSetOrganizer = (id: string) => {
    setMembers((prev) =>
      prev.map((m) => ({
        ...m,
        role: m.id === id ? 'organizer' : 'member',
      }))
    );
  };

  const handleNextFromStep2 = () => {
    setError(null);
    if (members.length === 0) {
      setError('Please include at least one member in the group.');
      return;
    }
    // Automatically initialize total group budget to sum of individual budgets if default
    if (totalBudget === 20000 && sumOfIndividualBudgets > 0) {
      setTotalBudget(sumOfIndividualBudgets);
    }
    setStep(3);
  };

  // --- Step 3 Next ---
  const handleNextFromStep3 = () => {
    setError(null);
    if (totalBudget <= 0) {
      setError('Total group budget must be greater than zero.');
      return;
    }
    setStep(4);
  };

  // --- Step 4 Confirm & Create Trip ---
  const handleConfirmCreateTrip = () => {
    const tripId = `trip-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const newTrip: Trip = {
      id: tripId,
      name: name.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      startDate,
      endDate,
      description: description.trim() || undefined,
      isSample: false,
      totalBudget,
      members: members.map((m) => ({ ...m, tripId })),
      bookings: [],
      dependencies: [],
      expenses: [],
      settlements: [],
      alerts: [],
      financialSnapshots: [],
      createdAt: now,
      updatedAt: now,
    };

    upsertTrip(newTrip);
    setActiveTripId(tripId);
    onComplete(newTrip);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Wizard Progress Stepper */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs">
          <div className={`flex items-center gap-2 font-bold ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              1
            </span>
            <span className="hidden sm:inline">Trip Details</span>
          </div>

          <div className="w-8 sm:w-16 h-0.5 bg-border" />

          <div className={`flex items-center gap-2 font-bold ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              2
            </span>
            <span className="hidden sm:inline">Group Travelers</span>
          </div>

          <div className="w-8 sm:w-16 h-0.5 bg-border" />

          <div className={`flex items-center gap-2 font-bold ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              3
            </span>
            <span className="hidden sm:inline">Group Budget</span>
          </div>

          <div className="w-8 sm:w-16 h-0.5 bg-border" />

          <div className={`flex items-center gap-2 font-bold ${step >= 4 ? 'text-primary' : 'text-muted-foreground'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 4 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              4
            </span>
            <span className="hidden sm:inline">Review & Create</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: TRIP DETAILS */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-150">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-500" />
              Step 1: Where and When Are You Traveling?
            </h2>
            <p className="text-xs text-muted-foreground">
              Define destination, dates, and currency for your custom group trip.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="wizard-trip-name" className="text-xs font-semibold text-foreground">
                Trip Name *
              </label>
              <input
                id="wizard-trip-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Manali Adventure Expedition, Paris Spring Break"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="wizard-origin" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Origin City / Airport *
                </label>
                <input
                  id="wizard-origin"
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="e.g. New Delhi, Mumbai, London"
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="wizard-destination" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  Destination *
                </label>
                <input
                  id="wizard-destination"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Manali, Bali, Tokyo"
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="wizard-start-date" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  Start Date *
                </label>
                <input
                  id="wizard-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="wizard-end-date" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  End Date *
                </label>
                <input
                  id="wizard-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="wizard-currency" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  Trip Currency
                </label>
                <select
                  id="wizard-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wizard-description" className="text-xs font-semibold text-foreground">
                Trip Description (Optional)
              </label>
              <textarea
                id="wizard-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes on the trip goals, travel vibe, or key milestones..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNextFromStep1}
              className="py-2.5 px-5 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Continue to Travelers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: GROUP CONFIGURATION */}
      {step === 2 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Step 2: Add Group Travelers ({members.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure every traveler&apos;s personal budget, pace, and priority. Guest travelers do not need accounts.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddMember}
              className="py-2 px-3.5 rounded-xl text-xs font-bold bg-secondary text-foreground hover:bg-secondary/80 flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Traveler</span>
            </button>
          </div>

          {/* Members List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((m) => {
              const isRegistered = user && m.email === user.email;
              return (
                <div
                  key={m.id}
                  className="p-4 rounded-xl border border-border bg-background space-y-3 shadow-2xs relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{m.name}</span>
                        {m.role === 'organizer' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            Organizer
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block">
                        {isRegistered ? 'Registered User (You)' : m.email ? m.email : 'Guest Traveler'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMember(m)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                        title="Edit member"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs space-y-1 pt-1 border-t border-border/50">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Personal Budget:</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(m.personalBudget, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Style / Priority:</span>
                      <span className="capitalize text-foreground">
                        {m.preferences.preferredPace} · {m.preferences.priority}
                      </span>
                    </div>
                  </div>

                  {m.role !== 'organizer' && (
                    <button
                      type="button"
                      onClick={() => handleSetOrganizer(m.id)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Make Organizer
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/50 border border-border/60 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total of Individual Budgets:</span>
            <span className="font-bold text-foreground text-sm">
              {formatCurrency(sumOfIndividualBudgets, currency)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="py-2.5 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromStep2}
              className="py-2.5 px-5 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Continue to Budget</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: GROUP BUDGET */}
      {step === 3 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-150">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-500" />
              Step 3: Group Budget & Default Splitting
            </h2>
            <p className="text-xs text-muted-foreground">
              Verify group ceiling against member allocations and set your default expense split preference.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="wizard-total-budget" className="text-xs font-semibold text-foreground">
                Total Group Budget Ceiling ({currency}) *
              </label>
              <input
                id="wizard-total-budget"
                type="number"
                min="0"
                step="100"
                value={totalBudget}
                onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-base font-bold rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {/* Budget Balance Live Assessment */}
            <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Sum of {members.length} Traveler Budgets:</span>
                <span className="font-bold text-foreground">{formatCurrency(sumOfIndividualBudgets, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Total Group Budget Target:</span>
                <span className="font-bold text-foreground">{formatCurrency(totalBudget, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-border/60">
                <span className="font-semibold text-foreground">Budget Variance:</span>
                <span className={`font-bold ${budgetDifference === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {budgetDifference === 0
                    ? 'Perfect Match (₹0)'
                    : budgetDifference > 0
                    ? `+${formatCurrency(budgetDifference, currency)} unallocated buffer`
                    : `${formatCurrency(budgetDifference, currency)} individual shortfall`}
                </span>
              </div>
            </div>

            {budgetDifference !== 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Budget variance noted:</strong> The group budget ceiling differs from the sum of individual budgets by {formatCurrency(Math.abs(budgetDifference), currency)}.
                  Values are preserved as entered. TripSync Smart Budget Engine will track both group and member thresholds dynamically.
                </span>
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <label htmlFor="wizard-default-split" className="text-xs font-semibold text-foreground">
                Default Bill Splitting Preference
              </label>
              <select
                id="wizard-default-split"
                value={defaultSplit}
                onChange={(e) => setDefaultSplit(e.target.value as 'equal' | 'participation' | 'percentage')}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
              >
                <option value="equal">Equal Split (Equally among all trip members)</option>
                <option value="participation">Participation-Based (Only split among active participants)</option>
                <option value="percentage">Percentage-Based (Custom budget-weighted shares)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="py-2.5 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromStep3}
              className="py-2.5 px-5 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Review Summary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & CREATE */}
      {step === 4 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-150">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Step 4: Review and Launch Your Trip
            </h2>
            <p className="text-xs text-muted-foreground">
              Confirm all configurations before initializing your TripSync workspace.
            </p>
          </div>

          <div className="space-y-4">
            {/* Trip Summary Card */}
            <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-base text-foreground">{name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {origin} → {destination}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
                <span>Dates: <strong>{startDate} to {endDate}</strong></span>
                <span>Currency: <strong>{currency}</strong></span>
                <span>Group Budget: <strong>{formatCurrency(totalBudget, currency)}</strong></span>
              </div>
            </div>

            {/* Travelers Summary */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Travelers & Budgets ({members.length})
                </span>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {members.map((m) => (
                  <div key={m.id} className="p-3 rounded-lg border border-border bg-background text-xs space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{m.name} {m.role === 'organizer' && '(Organizer)'}</span>
                      <span>{formatCurrency(m.personalBudget, currency)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Pace: {m.preferences.preferredPace} · Style: {m.preferences.costSensitivity}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1 text-foreground">
              <div className="flex justify-between font-bold">
                <span>Default Expense Split:</span>
                <span className="capitalize">{defaultSplit} Split</span>
              </div>
              <div className="flex justify-between">
                <span>Consensus Engine Ready:</span>
                <span className="text-emerald-600 font-semibold">Enabled</span>
              </div>
              <div className="flex justify-between">
                <span>Change-Aware Recalculation:</span>
                <span className="text-emerald-600 font-semibold">Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="py-2.5 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleConfirmCreateTrip}
              className="py-2.5 px-6 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Create Trip & Launch Workspace</span>
            </button>
          </div>
        </div>
      )}

      {/* MEMBER EDIT / ADD MODAL */}
      {isMemberModalOpen && editingMember && (
        <MemberFormModal
          member={editingMember}
          currency={currency}
          onSave={handleSaveMember}
          onClose={() => {
            setIsMemberModalOpen(false);
            setEditingMember(null);
          }}
        />
      )}
    </div>
  );
};

// Sub-component: MemberFormModal
interface MemberFormModalProps {
  member: TripMember;
  currency: string;
  onSave: (m: TripMember) => void;
  onClose: () => void;
}

const MemberFormModal: React.FC<MemberFormModalProps> = ({ member, currency, onSave, onClose }) => {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email || '');
  const [personalBudget, setPersonalBudget] = useState(member.personalBudget);
  const [costSensitivity, setCostSensitivity] = useState(member.preferences.costSensitivity);
  const [preferredPace, setPreferredPace] = useState(member.preferences.preferredPace);
  const [priority, setPriority] = useState<TravelPriority>(member.preferences.priority);
  const [role, setRole] = useState(member.role);
  const [interestInput, setInterestInput] = useState(member.preferences.activityInterests.join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const interests = interestInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    onSave({
      ...member,
      name: name.trim(),
      email: email.trim(),
      personalBudget: Number(personalBudget) || 0,
      role,
      preferences: {
        ...member.preferences,
        activityInterests: interests.length > 0 ? interests : ['sightseeing'],
        costSensitivity,
        preferredPace,
        priority,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="font-bold text-foreground text-sm">
            {member.name ? `Edit ${member.name}` : 'Add New Traveler'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label htmlFor="member-fullname" className="text-xs font-semibold text-foreground">Traveler Name *</label>
            <input
              id="member-fullname"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya Sen"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="member-email" className="text-xs font-semibold text-foreground">Email (Optional)</label>
            <input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maya@example.com (optional for guests)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="member-budget" className="text-xs font-semibold text-foreground">Personal Budget ({currency})</label>
              <input
                id="member-budget"
                type="number"
                min="0"
                step="500"
                value={personalBudget}
                onChange={(e) => setPersonalBudget(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="member-role" className="text-xs font-semibold text-foreground">Group Role</label>
              <select
                id="member-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'organizer' | 'member')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background cursor-pointer"
              >
                <option value="member">Member</option>
                <option value="organizer">Organizer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label htmlFor="member-pace" className="text-[11px] font-semibold text-foreground">Pace</label>
              <select
                id="member-pace"
                value={preferredPace}
                onChange={(e) => setPreferredPace(e.target.value as 'relaxed' | 'moderate' | 'fast')}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background cursor-pointer"
              >
                <option value="relaxed">Relaxed</option>
                <option value="moderate">Moderate</option>
                <option value="fast">Fast</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="member-cost" className="text-[11px] font-semibold text-foreground">Cost Style</label>
              <select
                id="member-cost"
                value={costSensitivity}
                onChange={(e) => setCostSensitivity(e.target.value as 'budget' | 'balanced' | 'splurge')}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background cursor-pointer"
              >
                <option value="budget">Budget</option>
                <option value="balanced">Balanced</option>
                <option value="splurge">Splurge</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="member-priority" className="text-[11px] font-semibold text-foreground">Priority</label>
              <select
                id="member-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TravelPriority)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background cursor-pointer"
              >
                <option value="minimize-cost">Cost</option>
                <option value="preserve-activity">Activity</option>
                <option value="earliest-arrival">Arrival</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="member-interests" className="text-xs font-semibold text-foreground">Activity Interests (comma separated)</label>
            <input
              id="member-interests"
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              placeholder="e.g. scuba, beach, nightlife, trekking"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 text-xs border border-border rounded-lg hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 cursor-pointer"
            >
              Save Traveler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
