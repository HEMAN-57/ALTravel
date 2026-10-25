package tech.altravel.booking.dto;

import tech.altravel.booking.domain.BookingEntity;

import java.math.BigDecimal;
import java.time.Instant;

public record BookingResponse(
        String id,
        String tripId,
        String type,
        String provider,
        String location,
        Instant startTime,
        Instant endTime,
        BigDecimal cost,
        String currency,
        String status,
        Instant cancellationDeadline,
        Instant arrivalDeadline,
        String cancellationPolicyNotes,
        String notes,
        String confirmationReference,
        Instant createdAt
) {
    public static BookingResponse fromEntity(BookingEntity entity) {
        return new BookingResponse(
                entity.getId(),
                entity.getTrip().getId(),
                entity.getType(),
                entity.getProvider(),
                entity.getLocation(),
                entity.getStartTime(),
                entity.getEndTime(),
                entity.getCost(),
                entity.getCurrency(),
                entity.getStatus(),
                entity.getCancellationDeadline(),
                entity.getArrivalDeadline(),
                entity.getCancellationPolicyNotes(),
                entity.getNotes(),
                entity.getConfirmationReference(),
                entity.getCreatedAt()
        );
    }
}
