import React, { useState } from 'react';
import {
  X,
  Users,
  Plus,
  Edit2,
  Trash2,
  UserMinus,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { Trip } from '../../domain/trips/trip.types';
import { TripMember, TravelPriority } from '../../domain/group/member.types';
import { recalculateMemberDeparture } from '../../domain/recalculation/recalculation.engine';
import { formatCurrency } from '../../lib/utils';

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  onClose,
  trip,
  onUpdateTrip,
}) => {
  const members = trip.members || [];
  const currency = trip.bookings[0]?.currency || 'INR';

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'edit'>('list');
  const [editingMember, setEditingMember] = useState<TripMember | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [personalBudget, setPersonalBudget] = useState(15000);
  const [role, setRole] = useState<'organizer' | 'member'>('member');
  const [costSensitivity, setCostSensitivity] = useState<'budget' | 'balanced' | 'splurge'>('balanced');
  const [preferredPace, setPreferredPace] = useState<'relaxed' | 'moderate' | 'fast'>('moderate');
  const [priority, setPriority] = useState<TravelPriority>('minimize-cost');
  const [interests, setInterests] = useState('sightseeing, food');

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingMember(null);
    setName('');
    setEmail('');
    setPersonalBudget(15000);
    setRole('member');
    setCostSensitivity('balanced');
    setPreferredPace('moderate');
    setPriority('minimize-cost');
    setInterests('sightseeing, food');
    setActiveTab('add');
    setStatusMessage(null);
  };

  const handleOpenEdit = (m: TripMember) => {
    setEditingMember(m);
    setName(m.name);
    setEmail(m.email || '');
    setPersonalBudget(m.personalBudget);
    setRole(m.role);
    setCostSensitivity(m.preferences.costSensitivity);
    setPreferredPace(m.preferences.preferredPace);
    setPriority(m.preferences.priority);
    setInterests(m.preferences.activityInterests.join(', '));
    setActiveTab('edit');
    setStatusMessage(null);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedInterests = interests
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    let updatedMembers: TripMember[];

    if (activeTab === 'edit' && editingMember) {
      updatedMembers = members.map((m) =>
        m.id === editingMember.id
          ? {
              ...m,
              name: name.trim(),
              email: email.trim(),
              role,
              personalBudget: Number(personalBudget) || 0,
              preferences: {
                ...m.preferences,
                costSensitivity,
                preferredPace,
                priority,
                activityInterests: parsedInterests.length > 0 ? parsedInterests : ['sightseeing'],
              },
            }
          : m
      );
      setStatusMessage(`Updated details and budget for ${name}.`);
    } else {
      const newMember: TripMember = {
        id: `mem-${Date.now().toString(36)}`,
        tripId: trip.id,
        name: name.trim(),
        email: email.trim(),
        role,
        status: 'active',
        personalBudget: Number(personalBudget) || 0,
        preferences: {
          activityInterests: parsedInterests.length > 0 ? parsedInterests : ['sightseeing'],
          costSensitivity,
          preferredPace,
          priority,
          willingnessToPayExtraForSpeed: 0.5,
        },
      };
      updatedMembers = [...members, newMember];
      setStatusMessage(`Added ${name} to the trip roster.`);
    }

    onUpdateTrip({
      ...trip,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    });
    setActiveTab('list');
  };

  const handleRemoveMember = (id: string, memberName: string) => {
    if (members.length <= 1) {
      setStatusMessage('Cannot remove the only remaining traveler from the trip.');
      return;
    }
    const updatedMembers = members.filter((m) => m.id !== id);
    onUpdateTrip({
      ...trip,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage(`Removed ${memberName} from the trip.`);
  };

  const handleMarkDeparted = (id: string, memberName: string) => {
    // Execute change-aware recalculation for member departure
    const { updatedTrip } = recalculateMemberDeparture(trip, {
      departingMemberId: id,
      policy: 'group_absorbs_shared',
      reason: `${memberName} departed early. Shared fixed booking costs redistributed among remaining active members.`,
    });

    onUpdateTrip(updatedTrip);
    setStatusMessage(
      `${memberName} marked as departed. Change-Aware Consensus Engine recalculated shared booking liabilities for remaining active members.`
    );
  };

  const handleReactivateMember = (id: string, memberName: string) => {
    const updatedMembers = members.map((m) =>
      m.id === id ? { ...m, status: 'active' as const } : m
    );
    onUpdateTrip({
      ...trip,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage(`${memberName} reactivated as an active group traveler.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Group Traveler Management</h3>
              <p className="text-xs text-muted-foreground">
                Manage members, individual budgets, preferences, and handle early departures.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Action Bar */}
        {activeTab === 'list' && (
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-foreground">
              Current Roster ({members.length} Travelers)
            </span>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="py-1.5 px-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          </div>
        )}

        {/* TAB: LIST MEMBERS */}
        {activeTab === 'list' && (
          <div className="space-y-3">
            {members.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No travelers registered yet. Click &apos;Add Member&apos; to start.
              </div>
            ) : (
              <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden bg-background">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      m.status === 'departed' ? 'opacity-60 bg-muted/30' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{m.name}</span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
                          {m.role}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            m.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          Budget: <strong className="text-foreground">{formatCurrency(m.personalBudget, currency)}</strong>
                        </span>
                        <span>
                          Pace: <strong className="capitalize text-foreground">{m.preferences.preferredPace}</strong>
                        </span>
                        <span>
                          Priority: <strong className="capitalize text-foreground">{m.preferences.priority}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(m)}
                        className="py-1 px-2.5 rounded-lg text-xs font-medium border border-border hover:bg-accent text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      {m.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleMarkDeparted(m.id, m.name)}
                          className="py-1 px-2.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 flex items-center gap-1 cursor-pointer"
                          title="Recalculate remaining costs for departed member"
                        >
                          <UserMinus className="w-3 h-3" />
                          <span>Depart</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivateMember(m.id, m.name)}
                          className="py-1 px-2.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reactivate</span>
                        </button>
                      )}

                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id, m.name)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Remove traveler"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: ADD OR EDIT FORM */}
        {(activeTab === 'add' || activeTab === 'edit') && (
          <form onSubmit={handleSaveMember} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <span className="text-xs font-bold text-foreground">
                {activeTab === 'add' ? 'Add New Traveler' : `Edit Traveler: ${editingMember?.name}`}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Back to roster
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="mm-name" className="text-xs font-semibold text-foreground">Full Name *</label>
                <input
                  id="mm-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ananya Iyer"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="mm-email" className="text-xs font-semibold text-foreground">Email (Optional)</label>
                <input
                  id="mm-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ananya@tripsync.io"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="mm-budget" className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-muted-foreground" />
                  Personal Budget ({currency})
                </label>
                <input
                  id="mm-budget"
                  type="number"
                  min="0"
                  step="500"
                  value={personalBudget}
                  onChange={(e) => setPersonalBudget(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="mm-role" className="text-xs font-semibold text-foreground">Role</label>
                <select
                  id="mm-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'organizer' | 'member')}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background cursor-pointer"
                >
                  <option value="member">Member</option>
                  <option value="organizer">Organizer</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="mm-pace" className="text-xs font-semibold text-foreground">Pace</label>
                <select
                  id="mm-pace"
                  value={preferredPace}
                  onChange={(e) => setPreferredPace(e.target.value as 'relaxed' | 'moderate' | 'fast')}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background cursor-pointer capitalize"
                >
                  <option value="relaxed">Relaxed</option>
                  <option value="moderate">Moderate</option>
                  <option value="fast">Fast</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="mm-cost" className="text-xs font-semibold text-foreground">Cost Style</label>
                <select
                  id="mm-cost"
                  value={costSensitivity}
                  onChange={(e) => setCostSensitivity(e.target.value as 'budget' | 'balanced' | 'splurge')}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background cursor-pointer capitalize"
                >
                  <option value="budget">Budget</option>
                  <option value="balanced">Balanced</option>
                  <option value="splurge">Splurge</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="mm-priority" className="text-xs font-semibold text-foreground">Priority</label>
                <select
                  id="mm-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TravelPriority)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background cursor-pointer"
                >
                  <option value="minimize-cost">Minimise Cost</option>
                  <option value="preserve-activity">Preserve Activities</option>
                  <option value="earliest-arrival">Earliest Arrival</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="mm-interests" className="text-xs font-semibold text-foreground">Activity Interests (comma separated)</label>
              <input
                id="mm-interests"
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="scuba, trekking, nightlife"
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="py-2 px-3 text-xs border border-border rounded-xl hover:bg-accent cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-xs cursor-pointer"
              >
                {activeTab === 'add' ? 'Add Member' : 'Update Member'}
              </button>
            </div>
          </form>
        )}

        <div className="pt-3 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-xl font-bold text-xs bg-secondary text-foreground hover:bg-secondary/80 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
