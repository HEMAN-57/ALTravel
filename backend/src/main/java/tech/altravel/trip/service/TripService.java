package tech.altravel.trip.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.altravel.common.api.PageResponse;
import tech.altravel.common.error.ConflictException;
import tech.altravel.common.error.DomainValidationException;
import tech.altravel.common.error.ResourceNotFoundException;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;
import tech.altravel.trip.dto.CreateTripRequest;
import tech.altravel.trip.dto.TripResponse;
import tech.altravel.trip.dto.UpdateTripRequest;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import tech.altravel.security.domain.UserPrincipal;

import java.util.UUID;

@Service
@Transactional
public class TripService {

    private final TripRepository tripRepository;

    public TripService(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    public TripResponse createTrip(CreateTripRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new DomainValidationException("Trip end date cannot be earlier than start date.");
        }

        String tripId = (request.id() != null && !request.id().trim().isEmpty())
                ? request.id().trim()
                : "trip-" + UUID.randomUUID().toString().substring(0, 12);

        if (tripRepository.existsById(tripId)) {
            throw new ConflictException("Trip with ID '" + tripId + "' already exists.");
        }

        boolean isSample = request.isSample() != null && request.isSample();

        TripEntity entity = new TripEntity(
                tripId,
                request.name().trim(),
                request.origin().trim(),
                request.destination().trim(),
                request.startDate(),
                request.endDate(),
                isSample,
                request.description() != null ? request.description().trim() : null
        );

        if (request.totalBudget() != null) {
            entity.setTotalBudget(request.totalBudget());
        }

        // Derive user identity from security context if authenticated
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            entity.setUserId(principal.getId());
        }

        TripEntity saved = tripRepository.save(entity);
        return TripResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<TripResponse> getTrips(Pageable pageable) {
        Page<TripResponse> page = tripRepository.findAll(pageable)
                .map(TripResponse::fromEntity);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public TripResponse getTripById(String tripId) {
        return tripRepository.findById(tripId)
                .map(TripResponse::fromEntity)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found with ID: " + tripId));
    }

    public TripResponse updateTrip(String tripId, UpdateTripRequest request) {
        TripEntity entity = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found with ID: " + tripId));

        assertTripOwnership(entity);

        if (request.endDate().isBefore(request.startDate())) {
            throw new DomainValidationException("Trip end date cannot be earlier than start date.");
        }

        entity.setName(request.name().trim());
        entity.setOrigin(request.origin().trim());
        entity.setDestination(request.destination().trim());
        entity.setStartDate(request.startDate());
        entity.setEndDate(request.endDate());
        if (request.isSample() != null) {
            entity.setSample(request.isSample());
        }
        if (request.totalBudget() != null) {
            entity.setTotalBudget(request.totalBudget());
        }
        entity.setDescription(request.description() != null ? request.description().trim() : null);

        TripEntity updated = tripRepository.save(entity);
        return TripResponse.fromEntity(updated);
    }

    public void deleteTrip(String tripId) {
        TripEntity entity = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found with ID: " + tripId));

        assertTripOwnership(entity);

        tripRepository.delete(entity);
    }

    private void assertTripOwnership(TripEntity entity) {
        if (entity.getUserId() == null || entity.isSample()) {
            return; // Sample or public demo trips can be reset or updated in demo mode
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Full authentication is required to modify or delete this private trip.");
        }

        if (!entity.getUserId().equals(principal.getId())) {
            throw new AccessDeniedException("You do not have permission to modify or delete this trip.");
        }
    }
}
