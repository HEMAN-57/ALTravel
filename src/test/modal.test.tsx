import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { useState } from 'react';
import { Modal } from '../components/ui/Modal';

describe('Modal Component Keyboard Accessibility & Focus Management', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    vi.useRealTimers();
  });

  const TestHarness: React.FC<{ defaultOpen?: boolean; onModalClose?: () => void }> = ({
    defaultOpen = false,
    onModalClose,
  }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const handleClose = () => {
      setIsOpen(false);
      onModalClose?.();
    };

    return (
      <div>
        <button id="trigger-btn" onClick={() => setIsOpen(true)}>
          Open Modal
        </button>
        <Modal
          isOpen={isOpen}
          onClose={handleClose}
          title="Accessibility Test Modal"
          description="Modal focus management testing."
        >
          <input id="input-first" placeholder="First input" />
          <input id="input-second" placeholder="Second input" />
          <button id="btn-submit">Submit</button>
        </Modal>
      </div>
    );
  };

  it('moves focus into the dialog when it opens', async () => {
    render(<TestHarness defaultOpen={false} />);
    const trigger = screen.getByRole('button', { name: 'Open Modal' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);

    // Wait for setTimeout/focus move
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    // First focusable element inside the modal is the close button in the header
    expect(document.activeElement).toBe(closeBtn);
  });

  it('traps focus inside the dialog when tabbing forward', async () => {
    render(<TestHarness defaultOpen={true} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    const submitBtn = screen.getByRole('button', { name: 'Submit' });

    // Focus on the last focusable element
    submitBtn.focus();
    expect(document.activeElement).toBe(submitBtn);

    // Press Tab on the last element -> should wrap to first element (closeBtn)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('traps focus inside the dialog when tabbing backward with Shift+Tab', async () => {
    render(<TestHarness defaultOpen={true} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    const submitBtn = screen.getByRole('button', { name: 'Submit' });

    // Focus on the first focusable element
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Press Shift+Tab on the first element -> should wrap to last element (submitBtn)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submitBtn);
  });

  it('restores focus to the triggering element when the modal closes', async () => {
    render(<TestHarness defaultOpen={false} />);
    const trigger = screen.getByRole('button', { name: 'Open Modal' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open modal
    fireEvent.click(trigger);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    expect(document.activeElement).toBe(closeBtn);

    // Close modal via Close button
    fireEvent.click(closeBtn);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Focus must be restored to trigger button
    expect(document.activeElement).toBe(trigger);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Escape Test">
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll when open and restores it when closed', () => {
    expect(document.body.style.overflow).toBe('');

    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}} title="Scroll Lock Test">
        <p>Scroll test</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal isOpen={false} onClose={() => {}} title="Scroll Lock Test">
        <p>Scroll test</p>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('');
  });
});
