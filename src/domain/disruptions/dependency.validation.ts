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
  const structurallyValidList: BookingDependency[] = [];

  // Identify duplicate dependency IDs in advance so detection does not depend on array order
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const item of dependencies) {
    if (item && typeof item === 'object') {
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.id === 'string' && candidate.id.trim() !== '') {
        const trimmed = candidate.id.trim();
        if (seenIds.has(trimmed)) {
          duplicateIds.add(trimmed);
        } else {
          seenIds.add(trimmed);
        }
      }
    }
  }

  dependencies.forEach((item, index) => {
    const itemErrors: string[] = [];

    if (!item || typeof item !== 'object') {
      errors.push(`Dependency #${index + 1} must be a non-null object.`);
      return;
    }

    const candidate = item as Record<string, unknown>;
    const depId = typeof candidate.id === 'string' && candidate.id.trim() !== '' ? candidate.id.trim() : undefined;
    const depLabel = depId ? `Dependency "${depId}"` : `Dependency #${index + 1}`;

    // id
    if (!depId) {
      itemErrors.push(`Dependency #${index + 1} ID is required and must be a non-empty string.`);
    } else if (duplicateIds.has(depId)) {
      itemErrors.push(`Duplicate dependency ID "${depId}" detected.`);
    }

    // upstreamBookingId
    if (
      typeof candidate.upstreamBookingId !== 'string' ||
      candidate.upstreamBookingId.trim() === ''
    ) {
      itemErrors.push(`${depLabel} upstreamBookingId is required.`);
    } else if (!bookingIds.has(candidate.upstreamBookingId)) {
      itemErrors.push(
        `${depLabel} references nonexistent upstream booking ID "${candidate.upstreamBookingId}".`
      );
    }

    // downstreamBookingId
    if (
      typeof candidate.downstreamBookingId !== 'string' ||
      candidate.downstreamBookingId.trim() === ''
    ) {
      itemErrors.push(`${depLabel} downstreamBookingId is required.`);
    } else if (!bookingIds.has(candidate.downstreamBookingId)) {
      itemErrors.push(
        `${depLabel} references nonexistent downstream booking ID "${candidate.downstreamBookingId}".`
      );
    }

    // Self dependency
    if (
      typeof candidate.upstreamBookingId === 'string' &&
      typeof candidate.downstreamBookingId === 'string' &&
      candidate.upstreamBookingId.trim() !== '' &&
      candidate.upstreamBookingId === candidate.downstreamBookingId
    ) {
      itemErrors.push(
        `${depLabel} is an invalid self-dependency: booking "${candidate.upstreamBookingId}" cannot depend on itself.`
      );
    }

    // relationshipType
    if (
      typeof candidate.relationshipType !== 'string' ||
      !VALID_RELATIONSHIP_TYPES.includes(candidate.relationshipType as DependencyRelationshipType)
    ) {
      itemErrors.push(
        `${depLabel} relationshipType must be one of: ${VALID_RELATIONSHIP_TYPES.join(', ')}.`
      );
    }

    // commitmentType
    if (
      typeof candidate.commitmentType !== 'string' ||
      !VALID_COMMITMENT_TYPES.includes(candidate.commitmentType as BookingCommitmentType)
    ) {
      itemErrors.push(
        `${depLabel} commitmentType must be one of: ${VALID_COMMITMENT_TYPES.join(', ')}.`
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
        !Number.isFinite(candidate.requiredBufferMinutes) ||
        candidate.requiredBufferMinutes < 0
      ) {
        itemErrors.push(
          `${depLabel} requiredBufferMinutes, if specified, must be a non-negative number.`
        );
      }
    }

    if (itemErrors.length === 0) {
      structurallyValidList.push({
        id: depId as string,
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

    errors.push(...itemErrors);
  });

  // Cycle detection on structurally valid entries
  const adjacency = new Map<string, string[]>();
  for (const dep of structurallyValidList) {
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
  }

  // Deduplicate errors while preserving deterministic first-seen order
  const uniqueErrors = Array.from(new Set(errors));

  if (uniqueErrors.length > 0) {
    return { success: false, errors: uniqueErrors };
  }

  return { success: true, errors: [], data: structurallyValidList };
}
