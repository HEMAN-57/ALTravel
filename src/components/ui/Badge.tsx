import React from 'react';
import { cn } from '../../lib/utils';
import { BookingStatus, BookingType } from '../../domain/bookings/booking.types';
import { Plane, Train, Building, Compass, Sparkles } from 'lucide-react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'simulated' | BookingStatus | BookingType;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const getVariantStyles = (): string => {
    switch (variant) {
      case 'confirmed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
      case 'delayed':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      case 'cancelled':
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      case 'completed':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
      case 'flight':
        return 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
      case 'train':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800';
      case 'hotel':
        return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
      case 'activity':
        return 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      case 'simulated':
        return 'bg-amber-500/10 text-amber-800 border-amber-300/80 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-700';
      case 'outline':
        return 'border border-border text-foreground bg-transparent';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground border-transparent';
      case 'default':
      default:
        return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const renderIcon = () => {
    switch (variant) {
      case 'flight':
        return <Plane className="w-3 h-3 mr-1 inline-block" aria-hidden="true" />;
      case 'train':
        return <Train className="w-3 h-3 mr-1 inline-block" aria-hidden="true" />;
      case 'hotel':
        return <Building className="w-3 h-3 mr-1 inline-block" aria-hidden="true" />;
      case 'activity':
        return <Compass className="w-3 h-3 mr-1 inline-block" aria-hidden="true" />;
      case 'simulated':
        return <Sparkles className="w-3 h-3 mr-1 inline-block" aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        getVariantStyles(),
        className
      )}
      {...props}
    >
      {renderIcon()}
      {children}
    </span>
  );
};
