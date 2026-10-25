package tech.altravel.dependency.dto;

import tech.altravel.dependency.domain.BookingDependencyEntity;

public record DependencyResponse(
        String id,
        String tripId,
        String upstreamBookingId,
        String downstreamBookingId,
        String relationshipType,
        int requiredBufferMinutes,
        String commitmentType,
        String description
) {
    public static DependencyResponse fromEntity(BookingDependencyEntity entity) {
        return new DependencyResponse(
                entity.getId(),
                entity.getTrip().getId(),
                entity.getUpstreamBookingId(),
                entity.getDownstreamBookingId(),
                entity.getRelationshipType(),
                entity.getRequiredBufferMinutes() != null ? entity.getRequiredBufferMinutes() : 0,
                entity.getCommitmentType(),
                entity.getDescription()
        );
    }
}
