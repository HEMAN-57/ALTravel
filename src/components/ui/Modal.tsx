import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Capture triggering element before focus moves into the modal
    triggerElementRef.current = document.activeElement as HTMLElement | null;

    // Lock body scroll
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into dialog when it opens
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0]?.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 0);

    // Keyboard navigation: Escape to close and focus trapping inside the modal
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        if (!modalRef.current) return;

        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

        if (focusables.length === 0) {
          event.preventDefault();
          modalRef.current.focus();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement || !modalRef.current.contains(document.activeElement)) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalRef.current.contains(document.activeElement)) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      // Restore focus to triggering element when dialog closes
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
        triggerElementRef.current.focus();
      }
      triggerElementRef.current = null;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-2xl bg-card border border-border shadow-2xl transition-all z-10 overflow-hidden my-8 focus:outline-none',
          maxWidthClass,
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[calc(85vh-8rem)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
