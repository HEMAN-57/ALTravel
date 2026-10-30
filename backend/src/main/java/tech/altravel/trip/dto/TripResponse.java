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
        java.math.BigDecimal totalBudget,
        String userId,
        Instant createdAt,
        Instant updatedAt
) {
    public TripResponse(String id, String name, String origin, String destination,
                        LocalDate startDate, LocalDate endDate, boolean isSample,
                        String description, Instant createdAt, Instant updatedAt) {
        this(id, name, origin, destination, startDate, endDate, isSample, description, null, null, createdAt, updatedAt);
    }

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
                entity.getTotalBudget(),
                entity.getUserId(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
