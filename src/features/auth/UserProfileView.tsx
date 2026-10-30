import React, { useState, useEffect } from 'react';
import { User, Mail, DollarSign, Gauge, Compass, Save, CheckCircle2, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../../domain/auth/auth.context';

export const UserProfileView: React.FC = () => {
  const { user, profile, updateProfile, isLoading, error } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [preferredCurrency, setPreferredCurrency] = useState(profile?.preferredCurrency || 'INR');
  const [costSensitivity, setCostSensitivity] = useState<'budget' | 'balanced' | 'splurge'>(
    profile?.costSensitivity || 'balanced'
  );
  const [preferredPace, setPreferredPace] = useState<'relaxed' | 'moderate' | 'fast'>(
    profile?.preferredPace || 'moderate'
  );
  const [primaryPriority, setPrimaryPriority] = useState(
    profile?.primaryPriority || 'preserve-activity'
  );
  const [willingnessToPaySpeed, setWillingnessToPaySpeed] = useState(
    profile?.willingnessToPaySpeed ?? 0.5
  );
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
    }
    if (profile) {
      setPreferredCurrency(profile.preferredCurrency);
      setCostSensitivity(profile.costSensitivity);
      setPreferredPace(profile.preferredPace);
      setPrimaryPriority(profile.primaryPriority);
      setWillingnessToPaySpeed(profile.willingnessToPaySpeed);
    }
  }, [user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessToast(null);

    try {
      await updateProfile({
        fullName: fullName.trim(),
        preferredCurrency,
        costSensitivity,
        preferredPace,
        primaryPriority,
        willingnessToPaySpeed,
      });
      setSuccessToast('Your travel profile and default preferences have been updated.');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch {
      // Error handled by context
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-secondary/50 border border-border inline-block">
          <User className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Sign In Required</h2>
        <p className="text-sm text-muted-foreground">
          Please sign in to view and edit your personal profile and default preferences.
        </p>
      </div>
    );
  }

  // Derive initials for avatar
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Active';

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Header Profile Summary */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-primary text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
            {initials}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-foreground">{fullName || user.email}</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {user.role}
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {user.email}
            </p>
            <p className="text-[11px] text-muted-foreground">Member since: {memberSince}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
          <div className="px-3.5 py-2 rounded-xl bg-secondary border border-border/80 text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Default Currency
            </span>
            <span className="text-sm font-bold text-foreground">{preferredCurrency}</span>
          </div>
        </div>
      </div>

      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-500" />
            Personal Details & Currency
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your account identity and financial presentation preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="profile-fullname" className="text-xs font-semibold text-foreground">
              Display Name
            </label>
            <input
              id="profile-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-currency" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              Preferred Currency
            </label>
            <select
              id="profile-currency"
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            >
              <option value="INR">INR (₹) - Indian Rupee</option>
              <option value="USD">USD ($) - US Dollar</option>
              <option value="EUR">EUR (€) - Euro</option>
              <option value="GBP">GBP (£) - British Pound</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-border/80 space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-500" />
              Default Travel & Consensus Preferences
            </h2>
            <p className="text-xs text-muted-foreground">
              These defaults are automatically pre-populated when you join new group trips to balance consensus scores.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-pace" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                Travel Pace
              </label>
              <select
                id="profile-pace"
                value={preferredPace}
                onChange={(e) => setPreferredPace(e.target.value as 'relaxed' | 'moderate' | 'fast')}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer capitalize"
              >
                <option value="relaxed">Relaxed (Leisure focus)</option>
                <option value="moderate">Moderate (Balanced)</option>
                <option value="fast">Fast (Action packed)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="profile-cost-sens" className="text-xs font-semibold text-foreground">
                Cost Sensitivity
              </label>
              <select
                id="profile-cost-sens"
                value={costSensitivity}
                onChange={(e) => setCostSensitivity(e.target.value as 'budget' | 'balanced' | 'splurge')}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer capitalize"
              >
                <option value="budget">Budget Conscious</option>
                <option value="balanced">Balanced</option>
                <option value="splurge">Splurge / Luxury</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="profile-priority" className="text-xs font-semibold text-foreground">
                Primary Priority
              </label>
              <select
                id="profile-priority"
                value={primaryPriority}
                onChange={(e) => setPrimaryPriority(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
              >
                <option value="minimize-cost">Minimise Cost</option>
                <option value="preserve-activity">Preserve Activities</option>
                <option value="earliest-arrival">Earliest Arrival</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-secondary/50 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="profile-wtp" className="text-xs font-semibold text-foreground">
                Willingness to Pay Extra for Speed / Direct Flights
              </label>
              <span className="text-xs font-bold text-primary">
                {Math.round(willingnessToPaySpeed * 100)}%
              </span>
            </div>
            <input
              id="profile-wtp"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={willingnessToPaySpeed}
              onChange={(e) => setWillingnessToPaySpeed(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Strict Budget (0%)</span>
              <span>Balanced (50%)</span>
              <span>Speed at Any Cost (100%)</span>
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted credentials & secure JWT sessions</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="py-2.5 px-5 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
