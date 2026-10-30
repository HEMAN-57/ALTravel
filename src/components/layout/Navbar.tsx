import React, { useState } from 'react';
import { Button } from '../ui/Button';
import {
  Compass,
  Plus,
  Menu,
  X,
  RotateCcw,
  AlertTriangle,
  User,
  LogIn,
  LogOut,
  UserPlus,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../domain/auth/auth.context';

export type NavTab =
  | 'dashboard'
  | 'trips'
  | 'ledger'
  | 'recalculation'
  | 'consensus'
  | 'alerts'
  | 'recovery'
  | 'profile'
  | 'login'
  | 'signup'
  | 'wizard';

export interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onCreateTrip: () => void;
  onResetStorage: () => void;
  tripCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onCreateTrip,
  onResetStorage,
  tripCount,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleNavClick = (tab: NavTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  };

  const confirmReset = () => {
    setIsResetConfirmOpen(false);
    onResetStorage();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                  TripSync
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-500/20">
                    v2.0
                  </span>
                </span>
                <span className="hidden sm:block text-[11px] text-muted-foreground font-medium leading-none">
                  Intelligent Group Travel & Expense Management
                </span>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
              <button
                type="button"
                onClick={() => handleNavClick('dashboard')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                  activeTab === 'dashboard'
                    ? 'bg-secondary text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('trips')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer',
                  activeTab === 'trips'
                    ? 'bg-secondary text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>Itinerary</span>
                {tripCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-primary/10 text-primary font-bold">
                    {tripCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('ledger')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activeTab === 'ledger'
                    ? 'bg-secondary text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>Group Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('recalculation')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activeTab === 'recalculation'
                    ? 'bg-secondary text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>Financial Replanning</span>
                <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  USP
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('consensus')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activeTab === 'consensus'
                    ? 'bg-secondary text-teal-600 dark:text-teal-400 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>Consensus Engine</span>
                <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  X-Factor
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('alerts')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activeTab === 'alerts'
                    ? 'bg-secondary text-sky-600 dark:text-sky-400 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>Alerts</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('recovery')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer',
                  activeTab === 'recovery'
                    ? 'bg-secondary text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>Disruption DAG</span>
              </button>
            </nav>
          </div>


          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-muted-foreground hover:text-destructive text-xs"
              title="Reset TripSync demo and stored trips"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Data
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={onCreateTrip}
              className="shadow-xs font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Trip
            </Button>

            {/* Auth Profile Dropdown or Login/Signup */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl border border-border bg-card hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-bold text-foreground max-w-[110px] truncate">
                    {user.fullName || user.email}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-border text-xs">
                      <p className="font-bold text-foreground truncate">{user.fullName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNavClick('profile')}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-foreground hover:bg-accent flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      <span>My Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        handleNavClick('dashboard');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 flex items-center gap-2 border-t border-border cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={() => handleNavClick('login')}
                  className="py-1.5 px-3 rounded-lg text-xs font-bold text-foreground hover:bg-accent transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('signup')}
                  className="py-1.5 px-3 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={onCreateTrip}
              className="text-xs px-2.5 h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              New
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card px-4 pt-2 pb-4 space-y-1">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'dashboard'
                ? 'bg-secondary text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('trips')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              activeTab === 'trips'
                ? 'bg-secondary text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>My Trips</span>
            {tripCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                {tripCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('ledger')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              activeTab === 'ledger'
                ? 'bg-secondary text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>Group Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('recalculation')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              activeTab === 'recalculation'
                ? 'bg-secondary text-rose-600 dark:text-rose-400 font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>Financial Replanning (USP)</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('consensus')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              activeTab === 'consensus'
                ? 'bg-secondary text-teal-600 dark:text-teal-400 font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>Consensus Engine (X-Factor)</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('alerts')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              activeTab === 'alerts'
                ? 'bg-secondary text-sky-600 dark:text-sky-400 font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>Alerts</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('recovery')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              activeTab === 'recovery'
                ? 'bg-secondary text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>Disruption DAG</span>
          </button>


          {/* Mobile Auth actions */}
          <div className="pt-2 border-t border-border/60 space-y-1">
            {isAuthenticated && user ? (
              <>
                <button
                  type="button"
                  onClick={() => handleNavClick('profile')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent flex items-center gap-2 rounded-lg"
                >
                  <User className="w-4 h-4 text-indigo-500" />
                  <span>My Profile ({user.fullName})</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    handleNavClick('dashboard');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 flex items-center gap-2 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleNavClick('login')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent flex items-center gap-2 rounded-lg"
                >
                  <LogIn className="w-4 h-4 text-indigo-500" />
                  <span>Log In</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('signup')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 flex items-center gap-2 rounded-lg"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </button>
              </>
            )}
          </div>

          <div className="pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsResetConfirmOpen(true);
              }}
              className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Local Trips Storage
            </button>
          </div>
        </div>
      )}

      {/* Storage Reset Confirmation Dialog */}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Reset Local Trip Storage?"
        description="This will clear all TripSync stored trips and sample data from your browser."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 text-amber-800 dark:text-amber-200 rounded-lg text-xs leading-relaxed border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <p>
              Only TripSync application data will be cleared. Other browser storage and unrelated domains will remain untouched.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmReset}
            >
              Reset Data
            </Button>
          </div>
        </div>
      </Modal>
    </header>
  );
};
