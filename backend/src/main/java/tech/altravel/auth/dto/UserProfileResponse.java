package tech.altravel.auth.dto;

import tech.altravel.user.domain.UserProfileEntity;

import java.math.BigDecimal;
import java.time.Instant;

public record UserProfileResponse(
        String id,
        String userId,
        String preferredCurrency,
        String avatarUrl,
        String costSensitivity,
        String preferredPace,
        String primaryPriority,
        BigDecimal willingnessToPaySpeed,
        Instant createdAt,
        Instant updatedAt
) {
    public static UserProfileResponse fromEntity(UserProfileEntity entity) {
        return new UserProfileResponse(
                entity.getId(),
                entity.getUser().getId(),
                entity.getPreferredCurrency(),
                entity.getAvatarUrl(),
                entity.getCostSensitivity(),
                entity.getPreferredPace(),
                entity.getPrimaryPriority(),
                entity.getWillingnessToPaySpeed(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
