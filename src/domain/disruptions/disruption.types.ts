/**
 * Disruption Input and Propagation Output Contracts
 */

export type DisruptionType = 'delay' | 'cancellation';

export type ImpactStatus =
  | 'affected' // Definite downstream consequence (e.g. connection buffer violated, feeder cancelled)
  | 'atRisk' // Definite uncertainty or tight connection where data or policy is flexible/unconfirmed
  | 'unaffected' // Feasible connection where transfer buffer is satisfied or no dependency exists
  | 'unknown'; // Insufficient timing/schedule information to reach a deterministic conclusion

export interface DelayDisruption {
  type: 'delay';
  targetBookingId: string;
  delayMinutes: number; // Must be non-negative (>= 0)
  revisedArrivalTime?: string; // Optional ISO string
}

export interface CancellationDisruption {
  type: 'cancellation';
  targetBookingId: string;
  delayMinutes?: never;
  revisedArrivalTime?: never;
}

export type DisruptionInput = DelayDisruption | CancellationDisruption;

export interface DisruptionEvidence {
  upstreamBookingId: string;
  upstreamScheduledArrival?: string;
  upstreamRevisedArrival?: string;
  downstreamBookingId: string;
  downstreamScheduledStart?: string;
  downstreamArrivalDeadline?: string;
  requiredBufferMinutes?: number;
  availableTransferMinutes?: number;
  bufferDeficitMinutes?: number;
  relationshipType?: string;
  commitmentType?: string;
  missingInformation?: string[];
}

export interface BookingImpact {
  bookingId: string;
  status: ImpactStatus;
  cause: string;
  explanation: string;
  evidence?: DisruptionEvidence;
  revisedStartTime?: string;
  revisedEndTime?: string;
}

export interface DisruptionPropagationResult {
  success: boolean;
  errors?: string[];
  disruptedBookingId?: string;
  disruptionType?: DisruptionType;
  targetDisruption?: {
    bookingId: string;
    type: DisruptionType;
    delayMinutes?: number;
    originalStartTime: string;
    originalEndTime?: string;
    revisedStartTime?: string;
    revisedEndTime?: string;
  };
  impacts: BookingImpact[];
  summary: {
    totalBookingsEvaluated: number;
    totalAffected: number;
    totalAtRisk: number;
    totalUnaffected: number;
    totalUnknown: number;
  };
}
