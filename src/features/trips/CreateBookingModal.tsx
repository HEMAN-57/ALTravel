import React, { useState, useCallback } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Booking, BookingType, BookingStatus } from '../../domain/bookings/booking.types';
import { validateBooking } from '../../domain/bookings/booking.validation';

export interface CreateBookingModalProps {
  isOpen: boolean;
  tripId: string;
  onClose: () => void;
  onBookingCreated: (booking: Booking) => void;
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  tripId,
  onClose,
  onBookingCreated,
}) => {
  const [type, setType] = useState<BookingType>('flight');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [cost, setCost] = useState('0');
  const [currency, setCurrency] = useState('INR');
  const [status, setStatus] = useState<BookingStatus>('confirmed');
  const [cancellationDeadline, setCancellationDeadline] = useState('');
  const [arrivalDeadline, setArrivalDeadline] = useState('');
  const [cancellationPolicyNotes, setCancellationPolicyNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmationReference, setConfirmationReference] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setType('flight');
    setProvider('');
    setLocation('');
    setStartTime('');
    setEndTime('');
    setCost('0');
    setCurrency('INR');
    setStatus('confirmed');
    setCancellationDeadline('');
    setArrivalDeadline('');
    setCancellationPolicyNotes('');
    setNotes('');
    setConfirmationReference('');
    setFormErrors([]);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const bookingId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const parsedCost = parseFloat(cost);

    const toOptionalIso = (val: string): string | undefined => {
      const trimmed = val.trim();
      if (!trimmed) return undefined;
      const ms = Date.parse(trimmed);
      return Number.isNaN(ms) ? trimmed : new Date(ms).toISOString();
    };

    const candidate: Record<string, unknown> = {
      id: bookingId,
      tripId,
      type,
      provider: provider.trim(),
      location: location.trim(),
      startTime: toOptionalIso(startTime),
      endTime: toOptionalIso(endTime),
      cost: isNaN(parsedCost) ? -1 : parsedCost,
      currency: currency.trim() || 'INR',
      status,
      cancellationDeadline: toOptionalIso(cancellationDeadline),
      arrivalDeadline: toOptionalIso(arrivalDeadline),
      cancellationPolicyNotes: cancellationPolicyNotes.trim() || undefined,
      notes: notes.trim() || undefined,
      confirmationReference: confirmationReference.trim() || undefined,
    };

    const validation = validateBooking(candidate);

    if (!validation.success || !validation.data) {
      setFormErrors(validation.errors);
      return;
    }

    onBookingCreated(validation.data);
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Booking to Trip"
      description="Record a flight, train, hotel, or activity along with critical cutoff deadlines."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formErrors.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
            <p className="font-semibold">Please fix the following validation errors:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {formErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Booking Type"
            value={type}
            onChange={(e) => setType(e.target.value as BookingType)}
            options={[
              { value: 'flight', label: 'Flight' },
              { value: 'train', label: 'Train' },
              { value: 'hotel', label: 'Hotel' },
              { value: 'activity', label: 'Activity' },
            ]}
            required
          />

          <Select
            label="Initial Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus)}
            options={[
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'pending', label: 'Pending' },
              { value: 'delayed', label: 'Delayed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Provider / Name"
            placeholder="e.g. IndiGo 6E-532 or Grand Hyatt"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            required
          />
          <Input
            label="Confirmation / Reference"
            placeholder="e.g. 6E-X948 or PNR-10294"
            value={confirmationReference}
            onChange={(e) => setConfirmationReference(e.target.value)}
          />
        </div>

        <Input
          label="Location / Route"
          placeholder="e.g. RGIA Hyderabad (HYD) → Goa (GOI) or Calangute, Goa"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={type === 'flight' || type === 'train' ? 'Departure Time (Required)' : 'Start Time / Check-In (Optional)'}
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required={type === 'flight' || type === 'train'}
          />
          <Input
            label="End Time / Arrival / Check-Out (Optional)"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Cost"
            type="number"
            min="0"
            step="1"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
          />
          <Input
            label="Currency"
            placeholder="INR, USD, EUR..."
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            required
          />
        </div>

        <div className="border-t border-border pt-3 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Critical Cutoffs & Recovery Deadlines
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Arrival / Check-in Cutoff Deadline"
              type="datetime-local"
              value={arrivalDeadline}
              onChange={(e) => setArrivalDeadline(e.target.value)}
              hint="Cutoff after which you are marked as no-show."
            />
            <Input
              label="Cancellation Cutoff Deadline"
              type="datetime-local"
              value={cancellationDeadline}
              onChange={(e) => setCancellationDeadline(e.target.value)}
              hint="Cutoff time for refundable or low-fee cancellation."
            />
          </div>

          <Input
            label="Cancellation Policy Summary"
            placeholder="e.g. Free cancellation until 24h prior, non-refundable afterwards"
            value={cancellationPolicyNotes}
            onChange={(e) => setCancellationPolicyNotes(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Optional Notes
          </label>
          <textarea
            rows={2}
            placeholder="Terminal, baggage restrictions, gear rental notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Save Booking
          </Button>
        </div>
      </form>
    </Modal>
  );
};
