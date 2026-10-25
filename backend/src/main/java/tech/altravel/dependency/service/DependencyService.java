package tech.altravel.dependency.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.altravel.booking.domain.BookingRepository;
import tech.altravel.common.error.ConflictException;
import tech.altravel.common.error.DomainValidationException;
import tech.altravel.common.error.ResourceNotFoundException;
import tech.altravel.dependency.domain.BookingDependencyEntity;
import tech.altravel.dependency.domain.BookingDependencyRepository;
import tech.altravel.dependency.dto.CreateDependencyRequest;
import tech.altravel.dependency.dto.DependencyResponse;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class DependencyService {

    public static final Set<String> VALID_RELATIONSHIP_TYPES = Set.of(
            "transit-connection",
            "arrival-to-activity",
            "arrival-to-lodging"
    );

    public static final Set<String> VALID_COMMITMENT_TYPES = Set.of("hard", "flexible");

    private final BookingDependencyRepository dependencyRepository;
    private final BookingRepository bookingRepository;
    private final TripRepository tripRepository;

    public DependencyService(BookingDependencyRepository dependencyRepository,
                             BookingRepository bookingRepository,
                             TripRepository tripRepository) {
        this.dependencyRepository = dependencyRepository;
        this.bookingRepository = bookingRepository;
        this.tripRepository = tripRepository;
    }

    public DependencyResponse createDependency(String tripId, CreateDependencyRequest request) {
        TripEntity trip = tripRepository.findByIdForUpdate(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found with ID: " + tripId));

        String upstreamId = request.upstreamBookingId().trim();
        String downstreamId = request.downstreamBookingId().trim();

        if (upstreamId.equals(downstreamId)) {
            throw new DomainValidationException("Invalid self-dependency: booking '" + upstreamId + "' cannot depend on itself.");
        }

        String relationshipType = request.relationshipType().trim().toLowerCase();
        if (!VALID_RELATIONSHIP_TYPES.contains(relationshipType)) {
            throw new DomainValidationException("Relationship type must be one of: " + String.join(", ", VALID_RELATIONSHIP_TYPES) + ".");
        }

        String commitmentType = (request.commitmentType() != null && !request.commitmentType().trim().isEmpty())
                ? request.commitmentType().trim().toLowerCase()
                : "hard";
        if (!VALID_COMMITMENT_TYPES.contains(commitmentType)) {
            throw new DomainValidationException("Commitment type must be one of: " + String.join(", ", VALID_COMMITMENT_TYPES) + ".");
        }

        int bufferMinutes = request.requiredBufferMinutes() != null ? request.requiredBufferMinutes() : 0;
        if (bufferMinutes < 0) {
            throw new DomainValidationException("Required buffer minutes must be non-negative.");
        }

        if (!bookingRepository.existsByIdAndTripId(upstreamId, tripId)) {
            throw new DomainValidationException("Upstream booking '" + upstreamId + "' does not belong to trip '" + tripId + "'.");
        }

        if (!bookingRepository.existsByIdAndTripId(downstreamId, tripId)) {
            throw new DomainValidationException("Downstream booking '" + downstreamId + "' does not belong to trip '" + tripId + "'.");
        }

        if (dependencyRepository.existsByTripIdAndUpstreamBookingIdAndDownstreamBookingId(tripId, upstreamId, downstreamId)) {
            throw new ConflictException("Duplicate dependency: a dependency from '" + upstreamId + "' to '" + downstreamId + "' already exists in trip '" + tripId + "'.");
        }

        // Validate cycle detection
        validateNoCycle(tripId, upstreamId, downstreamId);

        String depId = (request.id() != null && !request.id().trim().isEmpty())
                ? request.id().trim()
                : "dep-" + UUID.randomUUID().toString().substring(0, 12);

        if (dependencyRepository.existsById(depId)) {
            throw new ConflictException("Dependency with ID '" + depId + "' already exists.");
        }

        BookingDependencyEntity entity = new BookingDependencyEntity(
                depId,
                trip,
                upstreamId,
                downstreamId,
                relationshipType,
                bufferMinutes,
                commitmentType,
                request.description() != null ? request.description().trim() : null
        );

        BookingDependencyEntity saved = dependencyRepository.save(entity);
        return DependencyResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<DependencyResponse> getDependenciesByTripId(String tripId) {
        if (!tripRepository.existsById(tripId)) {
            throw new ResourceNotFoundException("Trip not found with ID: " + tripId);
        }
        return dependencyRepository.findByTripId(tripId)
                .stream()
                .map(DependencyResponse::fromEntity)
                .toList();
    }

    public void deleteDependency(String tripId, String dependencyId) {
        if (!tripRepository.existsById(tripId)) {
            throw new ResourceNotFoundException("Trip not found with ID: " + tripId);
        }

        BookingDependencyEntity dep = dependencyRepository.findByIdAndTripId(dependencyId, tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Dependency '" + dependencyId + "' not found for trip '" + tripId + "'."));

        dependencyRepository.delete(dep);
    }

    private void validateNoCycle(String tripId, String candidateUpstream, String candidateDownstream) {
        List<BookingDependencyEntity> existing = dependencyRepository.findByTripId(tripId);

        // Build adjacency graph with existing edges plus the candidate edge
        Map<String, List<String>> adjacency = new HashMap<>();
        Set<String> allNodes = new HashSet<>();

        allNodes.add(candidateUpstream);
        allNodes.add(candidateDownstream);
        adjacency.computeIfAbsent(candidateUpstream, k -> new ArrayList<>()).add(candidateDownstream);

        for (BookingDependencyEntity dep : existing) {
            allNodes.add(dep.getUpstreamBookingId());
            allNodes.add(dep.getDownstreamBookingId());
            adjacency.computeIfAbsent(dep.getUpstreamBookingId(), k -> new ArrayList<>()).add(dep.getDownstreamBookingId());
        }

        // 3-color DFS cycle detection: 0 = unvisited, 1 = visiting (in stack), 2 = visited
        Map<String, Integer> state = new HashMap<>();
        List<String> path = new ArrayList<>();
        List<String> cycleNodes = new ArrayList<>();

        for (String node : allNodes) {
            if (state.getOrDefault(node, 0) == 0) {
                if (dfsFindCycle(node, adjacency, state, path, cycleNodes)) {
                    break;
                }
            }
        }

        if (!cycleNodes.isEmpty()) {
            throw new ConflictException("Dependency cycle detected involving bookings: " + String.join(" → ", cycleNodes) + ".");
        }
    }

    private boolean dfsFindCycle(String current,
                                 Map<String, List<String>> adjacency,
                                 Map<String, Integer> state,
                                 List<String> path,
                                 List<String> cycleNodes) {
        state.put(current, 1);
        path.add(current);

        List<String> neighbors = adjacency.getOrDefault(current, Collections.emptyList());
        for (String neighbor : neighbors) {
            int neighborState = state.getOrDefault(neighbor, 0);
            if (neighborState == 1) {
                // Cycle found
                int startIndex = path.indexOf(neighbor);
                if (startIndex != -1) {
                    cycleNodes.addAll(path.subList(startIndex, path.size()));
                    cycleNodes.add(neighbor);
                } else {
                    cycleNodes.add(current);
                    cycleNodes.add(neighbor);
                }
                return true;
            } else if (neighborState == 0) {
                if (dfsFindCycle(neighbor, adjacency, state, path, cycleNodes)) {
                    return true;
                }
            }
        }

        path.remove(path.size() - 1);
        state.put(current, 2);
        return false;
    }
}
