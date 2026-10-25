import React from 'react';
import { Navbar, NavTab } from './Navbar';
import { Footer } from './Footer';

export interface AppShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onCreateTrip: () => void;
  onResetStorage: () => void;
  tripCount: number;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  onCreateTrip,
  onResetStorage,
  tripCount,
  children,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      <Navbar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCreateTrip={onCreateTrip}
        onResetStorage={onResetStorage}
        tripCount={tripCount}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
};
