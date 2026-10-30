import React, { useState } from 'react';
import { Trip } from '../../domain/trips/trip.types';

import { generateTripAlerts } from '../../domain/alerts/alert.engine';
import { AlertSeverity } from '../../domain/alerts/alert.types';
import { Card, CardContent } from '../../components/ui/Card';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';


export interface AlertsCenterViewProps {
  trip: Trip;
}

export const AlertsCenterView: React.FC<AlertsCenterViewProps> = ({ trip }) => {
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
  const allAlerts = generateTripAlerts(trip);

  const filteredAlerts = filterSeverity === 'all'
    ? allAlerts
    : allAlerts.filter((a) => a.severity === filterSeverity);

  const criticalCount = allAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = allAlerts.filter((a) => a.severity === 'warning').length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-semibold backdrop-blur-sm border border-white/10">
              <Bell className="w-3.5 h-3.5" />
              <span>Expense Tracking & Real-Time Alerts</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Trip Notification Center</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Autonomous monitoring of budget thresholds, schedule disruptions, member shifts, and pending debts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} Warning
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${
                filterSeverity === sev
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground">
          Showing {filteredAlerts.length} of {allAlerts.length} alert{allAlerts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <Card className="bg-card border-border shadow-xs text-center p-8 text-xs text-muted-foreground">
            No active alerts matching your filter. All systems operational.
          </Card>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const isWarning = alert.severity === 'warning';

            return (
              <Card
                key={alert.id}
                className={`border shadow-xs transition-colors ${
                  isCritical
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : isWarning
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-border bg-card'
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3.5">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isCritical
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : isWarning
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                    }`}
                  >
                    {isCritical && <AlertCircle className="w-5 h-5" />}
                    {isWarning && <AlertTriangle className="w-5 h-5" />}
                    {!isCritical && !isWarning && <Info className="w-5 h-5" />}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{alert.title}</span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                              : isWarning
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                          }`}
                        >
                          {alert.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
