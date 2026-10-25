import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Trip } from '../../domain/trips/trip.types';
import { validateTrip } from '../../domain/trips/trip.validation';

export interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripCreated: (trip: Trip) => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  onTripCreated,
}) => {
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const resetForm = () => {
    setName('');
    setOrigin('');
    setDestination('');
    setStartDate('');
    setEndDate('');
    setDescription('');
    setFormErrors([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const newTripId = `trip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const candidateTrip: Trip = {
      id: newTripId,
      name,
      origin,
      destination,
      startDate,
      endDate,
      description: description.trim() || undefined,
      bookings: [],
      isSample: false,
      createdAt: now,
      updatedAt: now,
    };

    const validation = validateTrip(candidateTrip);

    if (!validation.success || !validation.data) {
      setFormErrors(validation.errors);
      return;
    }

    onTripCreated(validation.data);
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Trip"
      description="Define the core itinerary and dates for your journey."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formErrors.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-1">
            <p className="font-semibold">Please resolve the following issues:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {formErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <Input
          label="Trip Name"
          placeholder="e.g. Goa Coastal Getaway or Q4 Business Summit"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Origin"
            placeholder="e.g. Hyderabad (HYD)"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
          />
          <Input
            label="Destination"
            placeholder="e.g. Goa (GOI)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Optional Notes / Description
          </label>
          <textarea
            rows={3}
            placeholder="Key travel objectives, travelling party details, or special requirements..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm">
            Create Trip
          </Button>
        </div>
      </form>
    </Modal>
  );
};
