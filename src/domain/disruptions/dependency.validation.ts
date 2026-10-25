import { Booking } from '../bookings/booking.types';
import {
  BookingDependency,
  DependencyRelationshipType,
  BookingCommitmentType,
} from './dependency.types';

export const VALID_RELATIONSHIP_TYPES: readonly DependencyRelationshipType[] = [
  'transit-connection',
  'arrival-to-activity',
  'arrival-to-lodging',
] as const;

export const VALID_COMMITMENT_TYPES: readonly BookingCommitmentType[] = [
  'hard',
  'flexible',
] as const;

export interface DependencyValidationResult {
  success: boolean;
  errors: string[];
  data?: BookingDependency[];
}

/**
 * Validates dependencies between bookings:
 * - Checks schema invariants (ids, types, non-negative buffers)
 * - Ensures referenced bookings exist
 * - Forbids self-dependencies
 * - Detects and rejects directed cycles using DFS
 */
export function validateDependencies(
  dependencies: unknown,
  bookings: Booking[]
): DependencyValidationResult {
  const errors: string[] = [];

  if (!dependencies) {
    return { success: true, errors: [], data: [] };
  }

  if (!Array.isArray(dependencies)) {
    return { success: false, errors: ['Dependencies must be an array.'] };
  }

  const bookingIds = new Set(bookings.map((b) => b.id));
  const validatedList: BookingDependency[] = [];
  const dependencyIdSet = new Set<string>();

  dependencies.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Dependency #${index + 1} must be a non-null object.`);
      return;
    }

    const candidate = item as Record<string, unknown>;

    // id
    if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
      errors.push(`Dependency #${index + 1} ID is required and must be a non-empty string.`);
    } else if (dependencyIdSet.has(candidate.id)) {
      errors.push(`Duplicate dependency ID "${candidate.id}" detected.`);
    } else {
      dependencyIdSet.add(candidate.id);
    }

    // upstreamBookingId
    if (
      typeof candidate.upstreamBookingId !== 'string' ||
      candidate.upstreamBookingId.trim() === ''
    ) {
      errors.push(`Dependency #${index + 1} upstreamBookingId is required.`);
    } else if (!bookingIds.has(candidate.upstreamBookingId)) {
      errors.push(
        `Dependency #${index + 1} (${candidate.id || 'unnamed'}) references nonexistent upstream booking ID "${candidate.upstreamBookingId}".`
      );
    }

    // downstreamBookingId
    if (
      typeof candidate.downstreamBookingId !== 'string' ||
      candidate.downstreamBookingId.trim() === ''
    ) {
      errors.push(`Dependency #${index + 1} downstreamBookingId is required.`);
    } else if (!bookingIds.has(candidate.downstreamBookingId)) {
      errors.push(
        `Dependency #${index + 1} (${candidate.id || 'unnamed'}) references nonexistent downstream booking ID "${candidate.downstreamBookingId}".`
      );
    }

    // Self dependency
    if (
      typeof candidate.upstreamBookingId === 'string' &&
      typeof candidate.downstreamBookingId === 'string' &&
      candidate.upstreamBookingId === candidate.downstreamBookingId
    ) {
      errors.push(
        `Dependency #${index + 1} (${candidate.id || 'unnamed'}) is an invalid self-dependency: booking "${candidate.upstreamBookingId}" cannot depend on itself.`
      );
    }

    // relationshipType
    if (
      typeof candidate.relationshipType !== 'string' ||
      !VALID_RELATIONSHIP_TYPES.includes(candidate.relationshipType as DependencyRelationshipType)
    ) {
      errors.push(
        `Dependency #${index + 1} relationshipType must be one of: ${VALID_RELATIONSHIP_TYPES.join(', ')}.`
      );
    }

    // commitmentType
    if (
      typeof candidate.commitmentType !== 'string' ||
      !VALID_COMMITMENT_TYPES.includes(candidate.commitmentType as BookingCommitmentType)
    ) {
      errors.push(
        `Dependency #${index + 1} commitmentType must be one of: ${VALID_COMMITMENT_TYPES.join(', ')}.`
      );
    }

    // requiredBufferMinutes (optional)
    if (
      candidate.requiredBufferMinutes !== undefined &&
      candidate.requiredBufferMinutes !== null
    ) {
      if (
        typeof candidate.requiredBufferMinutes !== 'number' ||
        Number.isNaN(candidate.requiredBufferMinutes) ||
        candidate.requiredBufferMinutes < 0
      ) {
        errors.push(
          `Dependency #${index + 1} requiredBufferMinutes, if specified, must be a non-negative number.`
        );
      }
    }

    if (errors.length === 0) {
      validatedList.push({
        id: candidate.id as string,
        upstreamBookingId: candidate.upstreamBookingId as string,
        downstreamBookingId: candidate.downstreamBookingId as string,
        relationshipType: candidate.relationshipType as DependencyRelationshipType,
        commitmentType: candidate.commitmentType as BookingCommitmentType,
        requiredBufferMinutes:
          typeof candidate.requiredBufferMinutes === 'number'
            ? candidate.requiredBufferMinutes
            : undefined,
        description:
          typeof candidate.description === 'string' && candidate.description.trim() !== ''
            ? candidate.description.trim()
            : undefined,
      });
    }
  });

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Directed cycle detection on the graph
  const adjacency = new Map<string, string[]>();
  for (const dep of validatedList) {
    const list = adjacency.get(dep.upstreamBookingId) || [];
    list.push(dep.downstreamBookingId);
    adjacency.set(dep.upstreamBookingId, list);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];
  let detectedCycle: string[] | null = null;

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        // Cycle detected
        const cycleStartIndex = path.indexOf(neighbor);
        detectedCycle = [...path.slice(cycleStartIndex), neighbor];
        return true;
      }
    }

    path.pop();
    inStack.delete(node);
    return false;
  }

  for (const booking of bookings) {
    if (!visited.has(booking.id)) {
      if (dfs(booking.id)) {
        break;
      }
    }
  }

  if (detectedCycle) {
    errors.push(
      `Dependency cycle detected involving bookings: ${(detectedCycle as string[]).join(' → ')}.`
    );
    return { success: false, errors };
  }

  return { success: true, errors: [], data: validatedList };
}
