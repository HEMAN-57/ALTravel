package tech.altravel.trip.dto;

import tech.altravel.trip.domain.TripEntity;

import java.time.Instant;
import java.time.LocalDate;

public record TripResponse(
        String id,
        String name,
        String origin,
        String destination,
        LocalDate startDate,
        LocalDate endDate,
        boolean isSample,
        String description,
        Instant createdAt,
        Instant updatedAt
) {
    public static TripResponse fromEntity(TripEntity entity) {
        return new TripResponse(
                entity.getId(),
                entity.getName(),
                entity.getOrigin(),
                entity.getDestination(),
                entity.getStartDate(),
                entity.getEndDate(),
                entity.isSample(),
                entity.getDescription(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
