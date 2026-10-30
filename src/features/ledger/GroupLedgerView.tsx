import React, { useState } from 'react';
import { Trip } from '../../domain/trips/trip.types';
import { Expense, ExpenseCategory, SplitType } from '../../domain/expenses/expense.types';
import { computeTripLedger } from '../../domain/expenses/splitting.engine';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatCurrency } from '../../lib/utils';
import {
  Wallet,
  Receipt,
  Users,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
} from 'lucide-react';

export interface GroupLedgerViewProps {
  trip: Trip;
  onUpdateTrip: (updated: Trip) => void;
}

export const GroupLedgerView: React.FC<GroupLedgerViewProps> = ({ trip, onUpdateTrip }) => {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('food');
  const [newPayerId, setNewPayerId] = useState<string>(trip.members?.[0]?.id || '');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    trip.members?.filter((m) => m.status === 'active').map((m) => m.id) || []
  );
  const [splitType] = useState<SplitType>('equal');


  const ledger = computeTripLedger(trip);
  const currency = ledger.currency;
  const members = trip.members || [];
  const activeMembers = members.filter((m) => m.status === 'active');

  const handleOpenAddExpense = () => {
    setNewTitle('');
    setNewAmount('');
    setNewCategory('activity');
    const firstActive = trip.members?.find((m) => m.status === 'active')?.id || trip.members?.[0]?.id || '';
    setNewPayerId(firstActive);
    setSelectedParticipants(
      trip.members?.filter((m) => m.status === 'active').map((m) => m.id) || []
    );
    setIsAddExpenseOpen(true);
  };

  const handleToggleParticipant = (memberId: string) => {
    if (selectedParticipants.includes(memberId)) {
      if (selectedParticipants.length > 1) {
        setSelectedParticipants(selectedParticipants.filter((id) => id !== memberId));
      }
    } else {
      setSelectedParticipants([...selectedParticipants, memberId]);
    }
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newAmount);
    if (!newTitle.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      tripId: trip.id,
      title: newTitle.trim(),
      amount: amountNum,
      currency,
      category: newCategory,
      paidByMemberId: newPayerId || members[0]?.id || 'default-organizer',
      participantMemberIds: selectedParticipants,
      splitType,
      createdAt: new Date().toISOString(),
    };

    const updated: Trip = {
      ...trip,
      expenses: [...(trip.expenses || []), newExpense],
      updatedAt: new Date().toISOString(),
    };

    onUpdateTrip(updated);
    setIsAddExpenseOpen(false);
    setNewTitle('');
    setNewAmount('');
  };

  const handleSettleDebt = (settlementId: string) => {
    const updatedSettlements = ledger.settlements.map((s) =>
      s.id === settlementId ? { ...s, status: 'completed' as const, settledAt: new Date().toISOString() } : s
    );

    onUpdateTrip({
      ...trip,
      settlements: updatedSettlements,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-8">
      {/* Group Budget Overview Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-semibold backdrop-blur-sm border border-white/10">
              <Wallet className="w-3.5 h-3.5" />
              <span>Smart Budget & Automated Bill Splitting</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Group Financial Ledger
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Real-time participation-aware expense allocation, individual budget limits, and exact paise-reconciled debt settlements.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddExpense}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Shared Expense
            </Button>
          </div>
        </div>

        {/* Aggregate Budget Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total Group Budget</span>
            <span className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(ledger.totalGroupBudget, currency)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 font-medium block">Committed Spend</span>
            <span className="text-xl font-bold text-amber-300 tracking-tight">
              {formatCurrency(ledger.totalGroupCommittedSpend, currency)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 font-medium block">Remaining Budget</span>
            <span className={`text-xl font-bold tracking-tight ${ledger.remainingGroupBudget < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatCurrency(ledger.remainingGroupBudget, currency)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 font-medium block">Group Budget Health</span>
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-1 bg-white/10">
              {ledger.groupBudgetStatus === 'ok' && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                </span>
              )}
              {ledger.groupBudgetStatus === 'warning' && (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> 85%+ Utilized
                </span>
              )}
              {ledger.groupBudgetStatus === 'exceeded' && (
                <span className="text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Exceeded!
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Member Balances & Personal Budgets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Member Balances & Personal Budgets
            </h2>
            <p className="text-xs text-muted-foreground">
              Tracks individual budget ceilings, money paid upfront, and net group balances.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ledger.memberSummaries.map((member) => {
            const isOwed = member.netBalance > 0;
            const owesMoney = member.netBalance < 0;

            return (
              <Card key={member.memberId} className="bg-card border-border shadow-xs hover:border-border/80 transition-colors">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-foreground">{member.memberName}</span>
                        {member.role === 'organizer' && (
                          <span className="text-[10px] py-0.5 px-2 rounded-full font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            Organizer
                          </span>
                        )}
                        {member.status === 'departed' && (
                          <span className="text-[10px] py-0.5 px-2 rounded-full font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                            Departed
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        Personal Budget: {formatCurrency(member.personalBudget, currency)}
                      </span>
                    </div>


                    {/* Net balance pill */}
                    <div className="text-right">
                      {isOwed && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          +{formatCurrency(member.netBalance, currency)}
                        </span>
                      )}
                      {owesMoney && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          {formatCurrency(member.netBalance, currency)}
                        </span>
                      )}
                      {!isOwed && !owesMoney && (
                        <span className="text-xs font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          Settled
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {isOwed ? 'Gets back' : owesMoney ? 'Owes group' : 'Net zero'}
                      </span>
                    </div>
                  </div>

                  {/* Budget Usage Progress Bar */}
                  <div className="space-y-1.5 pt-1 border-t border-border/60">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Committed:</span>
                      <span className="text-foreground font-semibold">
                        {formatCurrency(member.committedSpend, currency)}
                      </span>
                    </div>

                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          member.budgetStatus === 'exceeded'
                            ? 'bg-rose-500'
                            : member.budgetStatus === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min(100, member.budgetUtilizationPercent)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground">
                        {member.remainingBudget >= 0
                          ? `${formatCurrency(member.remainingBudget, currency)} remaining`
                          : `${formatCurrency(Math.abs(member.remainingBudget), currency)} over budget!`}
                      </span>
                      <span
                        className={`font-semibold ${
                          member.budgetStatus === 'exceeded'
                            ? 'text-rose-600 dark:text-rose-400'
                            : member.budgetStatus === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {member.budgetUtilizationPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Summary of payments */}
                  <div className="bg-secondary/40 rounded-lg p-2.5 text-[11px] space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Paid upfront:</span>
                      <span className="font-medium text-foreground">{formatCurrency(member.totalPaid, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total liability:</span>
                      <span className="font-medium text-foreground">{formatCurrency(member.totalOwed, currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Debt Simplification Settlement Plan */}
      <Card className="bg-card border-border shadow-xs">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                Simplified Debt Settlement Plan
              </h3>
              <p className="text-xs text-muted-foreground">
                Greedy settlement graph solver reduces group debt to the absolute minimum transactions.
              </p>
            </div>
            <Badge variant="simulated" className="text-xs">
              {ledger.settlements.length} Transaction{ledger.settlements.length === 1 ? '' : 's'} Needed
            </Badge>
          </div>

          {ledger.settlements.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs bg-secondary/30 rounded-xl">
              All balances are settled. Zero group transactions required!
            </div>
          ) : (
            <div className="space-y-3">
              {ledger.settlements.map((settlement, index) => {
                const debtor = members.find((m) => m.id === settlement.fromMemberId);
                const creditor = members.find((m) => m.id === settlement.toMemberId);
                const isSettled = settlement.status === 'completed';

                return (
                  <div
                    key={settlement.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isSettled
                        ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70'
                        : 'bg-secondary/40 border-border/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="text-xs sm:text-sm">
                        <span className="font-bold text-foreground">{debtor?.name || settlement.fromMemberId}</span>
                        <span className="text-muted-foreground mx-1.5">pays</span>
                        <span className="font-bold text-foreground">{creditor?.name || settlement.toMemberId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm sm:text-base text-foreground">
                        {formatCurrency(settlement.amount, currency)}
                      </span>

                      {isSettled ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSettleDebt(settlement.id)}
                          className="text-xs py-1 px-2.5 h-7"
                        >
                          Mark Settled
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill Splitting Breakdown per Booking and Expense */}
      <Card className="bg-card border-border shadow-xs">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sky-500" />
                Participation-Aware Expense Splitting Breakdown
              </h3>
              <p className="text-xs text-muted-foreground">
                Exact individual cost attribution per booking and ad-hoc expense.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2.5 px-3 font-semibold">Expense / Booking</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold">Total Cost</th>
                  <th className="py-2.5 px-3 font-semibold">Paid By</th>
                  <th className="py-2.5 px-3 font-semibold">Participants</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Per-Person Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {/* Bookings */}
                {trip.bookings.map((booking) => {
                  const payer = members.find((m) => m.id === booking.paidByMemberId);
                  const participants = booking.participantMemberIds && booking.participantMemberIds.length > 0
                    ? members.filter((m) => booking.participantMemberIds?.includes(m.id))
                    : activeMembers;
                  const isCancelled = booking.status === 'cancelled';
                  const shareAmount = isCancelled ? 0 : (participants.length > 0 ? booking.cost / participants.length : 0);

                  return (
                    <tr key={booking.id} className={`hover:bg-secondary/30 ${isCancelled ? 'opacity-50 line-through' : ''}`}>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-foreground block">{booking.provider}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {booking.type} {isCancelled && '(Cancelled - ₹0 Liability)'}
                        </span>
                      </td>
                      <td className="py-3 px-3 capitalize text-muted-foreground">{booking.type}</td>
                      <td className="py-3 px-3 font-bold text-foreground">
                        {isCancelled ? '₹0.00' : formatCurrency(booking.cost, booking.currency)}
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground">
                        {payer?.name || members[0]?.name || 'Organizer'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {participants.map((p) => (
                            <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              {p.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                        {isCancelled ? '₹0.00' : formatCurrency(shareAmount, booking.currency)}
                      </td>
                    </tr>
                  );
                })}

                {/* Ad-hoc expenses */}
                {trip.expenses?.map((exp) => {
                  const payer = members.find((m) => m.id === exp.paidByMemberId);
                  const participants = members.filter((m) => exp.participantMemberIds.includes(m.id));
                  const shareAmount = participants.length > 0 ? exp.amount / participants.length : 0;

                  return (
                    <tr key={exp.id} className="hover:bg-secondary/30">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-foreground block">{exp.title}</span>
                        <span className="text-[10px] text-muted-foreground">Ad-hoc expense</span>
                      </td>
                      <td className="py-3 px-3 capitalize text-muted-foreground">{exp.category}</td>
                      <td className="py-3 px-3 font-bold text-foreground">
                        {formatCurrency(exp.amount, exp.currency)}
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground">
                        {payer?.name || 'Group Member'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {participants.map((p) => (
                            <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">
                              {p.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sky-600 dark:text-sky-400">
                        {formatCurrency(shareAmount, exp.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        title="Add Shared Group Expense"
        description="Record on-trip dining, cabs, groceries, or unexpected costs and split among group members."
      >
        <form onSubmit={handleAddExpenseSubmit} className="space-y-4 pt-2">
          <Input
            id="expense-title"
            label="Expense Description"
            placeholder="e.g. Seafood Dinner at Martin's Corner"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="expense-amount"
              label={`Amount (${currency})`}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              required
            />

            <Select
              id="expense-category"
              label="Category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)}
              options={[
                { value: 'food', label: 'Food & Dining' },
                { value: 'transport', label: 'Local Transit' },
                { value: 'activity', label: 'Activity' },
                { value: 'lodging', label: 'Lodging' },
                { value: 'incidentals', label: 'Incidentals' },
                { value: 'emergency', label: 'Emergency' },
              ]}
            />
          </div>

          <Select
            id="expense-payer"
            label="Paid By"
            value={newPayerId}
            onChange={(e) => setNewPayerId(e.target.value)}
            options={members.map((m) => ({
              value: m.id,
              label: `${m.name} (${m.role})`,
            }))}
          />

          <div>
            <label className="text-xs font-semibold text-foreground block mb-2">
              Select Participating Members ({selectedParticipants.length} selected)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {members.map((m) => {
                const isSelected = selectedParticipants.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleParticipant(m.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 text-foreground font-semibold'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded flex items-center justify-center border text-[10px] ${
                        isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-muted-foreground'
                      }`}
                    >
                      {isSelected ? '✓' : ''}
                    </div>
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddExpenseOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save & Rebalance Ledger
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
