import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Compass, Plus, Menu, X, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';

export type NavTab = 'dashboard' | 'trips' | 'recovery';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleNavClick = (tab: NavTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
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
          <div className="flex items-center gap-8">
            <button
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2.5 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  ALTravel
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 bg-primary/10 text-primary rounded border border-primary/20">
                    M1
                  </span>
                </span>
                <span className="hidden sm:block text-[11px] text-muted-foreground font-medium leading-none">
                  When travel goes wrong, find your next best move.
                </span>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
              <button
                type="button"
                onClick={() => handleNavClick('dashboard')}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  activeTab === 'dashboard'
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('trips')}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer',
                  activeTab === 'trips'
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>My Trips</span>
                {tripCount > 0 && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                    {tripCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('recovery')}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
                  activeTab === 'recovery'
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>Recovery Planner</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  M2 Preview
                </span>
              </button>
            </nav>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-muted-foreground hover:text-destructive text-xs"
              title="Reset ALTravel demo and stored trips"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Data
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={onCreateTrip}
              className="shadow-sm font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Trip
            </Button>
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
            onClick={() => handleNavClick('recovery')}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between',
              activeTab === 'recovery'
                ? 'bg-secondary text-primary font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>Recovery Planner</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              M2 Preview
            </span>
          </button>

          <div className="pt-2 border-t border-border/60">
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
        description="This will clear all ALTravel stored trips and sample data from your browser."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 text-amber-800 dark:text-amber-200 rounded-lg text-xs leading-relaxed border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <p>
              Only ALTravel application data will be cleared. Other browser storage and unrelated domains will remain untouched.
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
