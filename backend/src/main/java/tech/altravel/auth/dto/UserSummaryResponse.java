package tech.altravel.auth.dto;

import tech.altravel.user.domain.UserEntity;

import java.time.Instant;

public record UserSummaryResponse(
        String id,
        String email,
        String fullName,
        String role,
        Instant createdAt
) {
    public static UserSummaryResponse fromEntity(UserEntity entity) {
        return new UserSummaryResponse(
                entity.getId(),
                entity.getEmail(),
                entity.getFullName(),
                entity.getRole(),
                entity.getCreatedAt()
        );
    }
}
