package tech.altravel.booking.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.altravel.booking.domain.BookingEntity;
import tech.altravel.booking.domain.BookingRepository;
import tech.altravel.booking.dto.BookingResponse;
import tech.altravel.booking.dto.CreateBookingRequest;
import tech.altravel.booking.dto.UpdateBookingRequest;
import tech.altravel.common.error.ConflictException;
import tech.altravel.common.error.DomainValidationException;
import tech.altravel.common.error.ResourceNotFoundException;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class BookingService {

    public static final Set<String> VALID_TYPES = Set.of("flight", "train", "hotel", "activity");
    public static final Set<String> VALID_STATUSES = Set.of("confirmed", "pending", "delayed", "cancelled", "completed");

    private final BookingRepository bookingRepository;
    private final TripRepository tripRepository;

    public BookingService(BookingRepository bookingRepository, TripRepository tripRepository) {
        this.bookingRepository = bookingRepository;
        this.tripRepository = tripRepository;
    }

    public BookingResponse createBooking(String tripId, CreateBookingRequest request) {
        TripEntity trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found with ID: " + tripId));

        validateBookingDetails(
                request.type(),
                request.status(),
                request.startTime(),
                request.endTime()
        );

        String bookingId = (request.id() != null && !request.id().trim().isEmpty())
                ? request.id().trim()
                : "book-" + UUID.randomUUID().toString().substring(0, 12);

        if (bookingRepository.existsById(bookingId)) {
            throw new ConflictException("Booking with ID '" + bookingId + "' already exists.");
        }

        String currency = (request.currency() != null && !request.currency().trim().isEmpty())
                ? request.currency().trim().toUpperCase()
                : "INR";

        String status = (request.status() != null && !request.status().trim().isEmpty())
                ? request.status().trim().toLowerCase()
                : "confirmed";

        BookingEntity entity = new BookingEntity(
                bookingId,
                trip,
                request.type().trim().toLowerCase(),
                request.provider().trim(),
                request.location().trim(),
                request.startTime(),
                request.endTime(),
                request.cost(),
                currency,
                status
        );

        entity.setCancellationDeadline(request.cancellationDeadline());
        entity.setArrivalDeadline(request.arrivalDeadline());
        entity.setCancellationPolicyNotes(request.cancellationPolicyNotes() != null ? request.cancellationPolicyNotes().trim() : null);
        entity.setNotes(request.notes() != null ? request.notes().trim() : null);
        entity.setConfirmationReference(request.confirmationReference() != null ? request.confirmationReference().trim() : null);

        BookingEntity saved = bookingRepository.save(entity);
        return BookingResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getBookingsByTripId(String tripId) {
        if (!tripRepository.existsById(tripId)) {
            throw new ResourceNotFoundException("Trip not found with ID: " + tripId);
        }
        return bookingRepository.findByTripIdOrderByStartTimeAsc(tripId)
                .stream()
                .map(BookingResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public BookingResponse getBooking(String tripId, String bookingId) {
        if (!tripRepository.existsById(tripId)) {
            throw new ResourceNotFoundException("Trip not found with ID: " + tripId);
        }
        return bookingRepository.findByIdAndTripId(bookingId, tripId)
                .map(BookingResponse::fromEntity)
                .orElseThrow(() -> new ResourceNotFoundException("Booking '" + bookingId + "' not found for trip '" + tripId + "'."));
    }

    public BookingResponse updateBooking(String tripId, String bookingId, UpdateBookingRequest request) {
        if (!tripRepository.existsById(tripId)) {
            throw new ResourceNotFoundException("Trip not found with ID: " + tripId);
        }

        BookingEntity entity = bookingRepository.findByIdAndTripId(bookingId, tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking '" + bookingId + "' not found for trip '" + tripId + "'."));

        validateBookingDetails(
                request.type(),
                request.status(),
                request.startTime(),
                request.endTime()
        );

        entity.setType(request.type().trim().toLowerCase());
        entity.setProvider(request.provider().trim());
        entity.setLocation(request.location().trim());
        entity.setStartTime(request.startTime());
        entity.setEndTime(request.endTime());
        entity.setCost(request.cost());
        entity.setCurrency(request.currency().trim().toUpperCase());
        entity.setStatus(request.status().trim().toLowerCase());
        entity.setCancellationDeadline(request.cancellationDeadline());
        entity.setArrivalDeadline(request.arrivalDeadline());
        entity.setCancellationPolicyNotes(request.cancellationPolicyNotes() != null ? request.cancellationPolicyNotes().trim() : null);
        entity.setNotes(request.notes() != null ? request.notes().trim() : null);
        entity.setConfirmationReference(request.confirmationReference() != null ? request.confirmationReference().trim() : null);

        BookingEntity updated = bookingRepository.save(entity);
        return BookingResponse.fromEntity(updated);
    }

    public void deleteBooking(String tripId, String bookingId) {
        if (!tripRepository.existsById(tripId)) {
            throw new ResourceNotFoundException("Trip not found with ID: " + tripId);
        }

        BookingEntity entity = bookingRepository.findByIdAndTripId(bookingId, tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking '" + bookingId + "' not found for trip '" + tripId + "'."));

        bookingRepository.delete(entity);
    }

    private void validateBookingDetails(String type, String status, java.time.Instant startTime, java.time.Instant endTime) {
        String normalizedType = type != null ? type.trim().toLowerCase() : "";
        if (!VALID_TYPES.contains(normalizedType)) {
            throw new DomainValidationException("Booking type must be one of: " + String.join(", ", VALID_TYPES) + ".");
        }

        if (status != null && !status.trim().isEmpty()) {
            String normalizedStatus = status.trim().toLowerCase();
            if (!VALID_STATUSES.contains(normalizedStatus)) {
                throw new DomainValidationException("Status must be one of: " + String.join(", ", VALID_STATUSES) + ".");
            }
        }

        if (("flight".equalsIgnoreCase(normalizedType) || "train".equalsIgnoreCase(normalizedType)) && startTime == null) {
            throw new DomainValidationException("Start time is required for transport bookings (flight, train).");
        }

        if (startTime != null && endTime != null && endTime.isBefore(startTime)) {
            throw new DomainValidationException("End time cannot precede start time.");
        }
    }
}
