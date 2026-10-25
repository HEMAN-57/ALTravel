import React, { useState } from 'react';
import { Trip } from '../../domain/trips/trip.types';
import { RecoveryOption, RecoveryOptionType } from '../../domain/recovery/recovery.types';
import { validateRecoveryOption } from '../../domain/recovery/recovery.engine';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

export interface AddRecoveryOptionModalProps {
  isOpen: boolean;
  trip: Trip;
  onClose: () => void;
  onOptionAdded: (option: RecoveryOption) => void;
}

const TYPE_OPTIONS: { value: RecoveryOptionType; label: string }[] = [
  { value: 'alternative-transport', label: 'Alternative Transport (Flight / Train)' },
  { value: 'local-transport', label: 'Local Ground Transport (Taxi / Metro / Bus)' },
  { value: 'contact-provider', label: 'Contact Provider (Late Check-in / Hold)' },
  { value: 'reschedule', label: 'Reschedule Commitment' },
  { value: 'drop-commitment', label: 'Drop / Cancel Commitment' },
];

export const AddRecoveryOptionModal: React.FC<AddRecoveryOptionModalProps> = ({
  isOpen,
  trip,
  onClose,
  onOptionAdded,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<RecoveryOptionType>('local-transport');
  const [targetBookingId, setTargetBookingId] = useState(trip.bookings[0]?.id || '');
  const [additionalCost, setAdditionalCost] = useState('1200');
  const [expectedDepartureTime, setExpectedDepartureTime] = useState('');
  const [expectedArrivalTime, setExpectedArrivalTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const bookingOptions = trip.bookings.map((b) => ({
    value: b.id,
    label: `${b.type.toUpperCase()}: ${b.provider} (${b.location})`,
  }));

  React.useEffect(() => {
    if (isOpen) {
      if (!targetBookingId || !trip.bookings.some((b) => b.id === targetBookingId)) {
        setTargetBookingId(trip.bookings[0]?.id || '');
      }
    }
  }, [isOpen, trip.id, trip.bookings, targetBookingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const costNum = parseFloat(additionalCost);
    if (isNaN(costNum) || costNum < 0) {
      setErrors(['Additional cost must be a non-negative number.']);
      return;
    }

    const candidate = {
      id: `opt-custom-${Date.now()}`,
      tripId: trip.id,
      title: title.trim(),
      description: description.trim(),
      type,
      additionalCost: costNum,
      currency: trip.bookings[0]?.currency || 'INR',
      targetBookingId: targetBookingId || trip.bookings[0]?.id || '',
      expectedDepartureTime: expectedDepartureTime.trim() !== '' ? expectedDepartureTime : undefined,
      expectedArrivalTime: expectedArrivalTime.trim() !== '' ? expectedArrivalTime : undefined,
      deadline: deadline.trim() !== '' ? deadline : undefined,
      deadlineType: deadline.trim() !== '' ? ('user-entered' as const) : ('unknown' as const),
      isSimulated,
      notes: notes.trim() !== '' ? notes.trim() : undefined,
    };

    const validation = validateRecoveryOption(candidate);
    if (!validation.success || !validation.data) {
      setErrors(validation.errors);
      return;
    }

    onOptionAdded(validation.data);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setType('local-transport');
    setAdditionalCost('1200');
    setExpectedDepartureTime('');
    setExpectedArrivalTime('');
    setDeadline('');
    setIsSimulated(false);
    setNotes('');
    setErrors([]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Candidate Recovery Option"
      description="Define an alternative travel leg, local transit connection, or provider arrangement to evaluate."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <Alert variant="destructive" title="Validation Failed">
            <ul className="list-disc pl-4 space-y-1">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Input
          label="Option Title"
          placeholder="e.g. Airport Direct Cab / Vande Bharat Express"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Description <span className="text-destructive">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details about route, transit mode, and how it mitigates disruption..."
            className="flex min-h-[70px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Option Type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value as RecoveryOptionType)}
          />

          <Select
            label="Addresses Booking"
            options={bookingOptions}
            value={targetBookingId}
            onChange={(e) => setTargetBookingId(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={`Additional Out-of-Pocket Cost (${trip.bookings[0]?.currency || 'INR'})`}
            type="number"
            min="0"
            step="1"
            value={additionalCost}
            onChange={(e) => setAdditionalCost(e.target.value)}
            required
          />

          <Input
            label="Booking Deadline (Optional)"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            hint="Leave blank if deadline is unknown / needs confirmation"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Expected Departure Time (Optional)"
            type="datetime-local"
            value={expectedDepartureTime}
            onChange={(e) => setExpectedDepartureTime(e.target.value)}
          />

          <Input
            label="Expected Arrival Time (Optional)"
            type="datetime-local"
            value={expectedArrivalTime}
            onChange={(e) => setExpectedArrivalTime(e.target.value)}
          />
        </div>

        <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-start gap-2.5">
          <input
            type="checkbox"
            id="isSimulatedCheckbox"
            checked={isSimulated}
            onChange={(e) => setIsSimulated(e.target.checked)}
            className="mt-0.5 rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
          />
          <label htmlFor="isSimulatedCheckbox" className="text-xs text-foreground cursor-pointer select-none">
            <span className="font-semibold block">Simulated Demonstration Option</span>
            <span className="text-muted-foreground block text-[11px]">
              Check this if this option uses synthetic/illustrative schedules or fares for demo purposes.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Save Option
          </Button>
        </div>
      </form>
    </Modal>
  );
};
