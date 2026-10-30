import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { useState } from 'react';
import { CreateTripModal } from '../features/trips/CreateTripModal';
import { Trip } from '../domain/trips/trip.types';

describe('CreateTripModal Input Focus & Continuous Typing', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    vi.useRealTimers();
  });

  // Harness that mimics real-world parent rendering with state and inline callbacks
  const ModalHarness: React.FC<{
    onTripCreated?: (trip: Trip) => void;
    onLaunchWizard?: () => void;
  }> = ({ onTripCreated = () => {}, onLaunchWizard = () => {} }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [, setRenderCount] = useState(0);

    return (
      <div>
        <button id="re-render-parent" onClick={() => setRenderCount((c) => c + 1)}>
          Re-render
        </button>
        <CreateTripModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onTripCreated={onTripCreated}
          onLaunchWizard={onLaunchWizard}
        />
      </div>
    );
  };

  it('types a multi-character trip name continuously without losing focus after any keystroke', async () => {
    render(<ModalHarness />);

    // Wait for initial modal open focus to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const tripNameInput = screen.getByLabelText(/trip name/i) as HTMLInputElement;

    // Focus input to begin typing
    tripNameInput.focus();
    expect(document.activeElement).toBe(tripNameInput);

    const fullText = 'Goa Coastal Getaway';
    let currentText = '';

    // Type each character one by one and check focus retention
    for (const char of fullText) {
      currentText += char;
      fireEvent.change(tripNameInput, { target: { value: currentText } });

      // Allow any microtasks / macrotasks (like state effects or timers) to execute
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Crucial assertion: input must NOT lose focus to modal close button or anywhere else
      expect(document.activeElement).toBe(tripNameInput);
      expect(tripNameInput.value).toBe(currentText);
    }

    expect(tripNameInput.value).toBe('Goa Coastal Getaway');
  });

  it('types into origin, destination, and notes inputs continuously without focus loss', async () => {
    render(<ModalHarness />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    // 1. Origin input
    const originInput = screen.getByLabelText(/origin/i) as HTMLInputElement;
    originInput.focus();
    expect(document.activeElement).toBe(originInput);

    const originText = 'Hyderabad (HYD)';
    let currOrigin = '';
    for (const char of originText) {
      currOrigin += char;
      fireEvent.change(originInput, { target: { value: currOrigin } });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      expect(document.activeElement).toBe(originInput);
    }
    expect(originInput.value).toBe('Hyderabad (HYD)');

    // 2. Destination input
    const destInput = screen.getByLabelText(/destination/i) as HTMLInputElement;
    destInput.focus();
    expect(document.activeElement).toBe(destInput);

    const destText = 'Goa Dabolim (GOI)';
    let currDest = '';
    for (const char of destText) {
      currDest += char;
      fireEvent.change(destInput, { target: { value: currDest } });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      expect(document.activeElement).toBe(destInput);
    }
    expect(destInput.value).toBe('Goa Dabolim (GOI)');

    // 3. Optional notes textarea
    const notesInput = screen.getByPlaceholderText(/key travel objectives/i) as HTMLTextAreaElement;
    notesInput.focus();
    expect(document.activeElement).toBe(notesInput);

    const notesText = 'Group reunion with budget tracking';
    let currNotes = '';
    for (const char of notesText) {
      currNotes += char;
      fireEvent.change(notesInput, { target: { value: currNotes } });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
      expect(document.activeElement).toBe(notesInput);
    }
    expect(notesInput.value).toBe('Group reunion with budget tracking');

    // 4. Verify origin and destination values remain completely intact
    expect(originInput.value).toBe('Hyderabad (HYD)');
    expect(destInput.value).toBe('Goa Dabolim (GOI)');
  });

  it('preserves field values across fields without resetting', async () => {
    render(<ModalHarness />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const tripNameInput = screen.getByLabelText(/trip name/i) as HTMLInputElement;
    const originInput = screen.getByLabelText(/origin/i) as HTMLInputElement;
    const destInput = screen.getByLabelText(/destination/i) as HTMLInputElement;
    const startDateInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
    const endDateInput = screen.getByLabelText(/end date/i) as HTMLInputElement;
    const notesInput = screen.getByPlaceholderText(/key travel objectives/i) as HTMLTextAreaElement;

    fireEvent.change(tripNameInput, { target: { value: 'Himalayan Trek' } });
    fireEvent.change(originInput, { target: { value: 'Chandigarh' } });
    fireEvent.change(destInput, { target: { value: 'Manali' } });
    fireEvent.change(startDateInput, { target: { value: '2026-12-01' } });
    fireEvent.change(endDateInput, { target: { value: '2026-12-07' } });
    fireEvent.change(notesInput, { target: { value: 'Pack thermals and winter boots' } });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(tripNameInput.value).toBe('Himalayan Trek');
    expect(originInput.value).toBe('Chandigarh');
    expect(destInput.value).toBe('Manali');
    expect(startDateInput.value).toBe('2026-12-01');
    expect(endDateInput.value).toBe('2026-12-07');
    expect(notesInput.value).toBe('Pack thermals and winter boots');
  });

  it('submits the form successfully with all entered fields', async () => {
    const handleTripCreated = vi.fn();
    render(<ModalHarness onTripCreated={handleTripCreated} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    fireEvent.change(screen.getByLabelText(/trip name/i), { target: { value: 'Bangalore Roadtrip' } });
    fireEvent.change(screen.getByLabelText(/origin/i), { target: { value: 'BLR' } });
    fireEvent.change(screen.getByLabelText(/destination/i), { target: { value: 'COK' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-11-20' } });

    const submitBtn = screen.getByRole('button', { name: /^create trip$/i });
    fireEvent.click(submitBtn);

    expect(handleTripCreated).toHaveBeenCalledTimes(1);
    const createdTrip = handleTripCreated.mock.calls[0]?.[0] as Trip;
    expect(createdTrip).toBeDefined();
    expect(createdTrip.name).toBe('Bangalore Roadtrip');
    expect(createdTrip.origin).toBe('BLR');
    expect(createdTrip.destination).toBe('COK');
    expect(createdTrip.startDate).toBe('2026-11-15');
    expect(createdTrip.endDate).toBe('2026-11-20');
  });

  it('allows clicking Launch Wizard button without losing state or erroring', async () => {
    const handleLaunchWizard = vi.fn();
    render(<ModalHarness onLaunchWizard={handleLaunchWizard} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const wizardBtn = screen.getByRole('button', { name: /launch wizard/i });
    fireEvent.click(wizardBtn);

    expect(handleLaunchWizard).toHaveBeenCalledTimes(1);
  });
});
