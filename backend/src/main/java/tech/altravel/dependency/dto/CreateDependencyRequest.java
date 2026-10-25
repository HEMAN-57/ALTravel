package tech.altravel.dependency.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDependencyRequest(
        @Size(max = 64, message = "Dependency ID must not exceed 64 characters")
        String id,

        @NotBlank(message = "Upstream booking ID is required")
        @Size(max = 64, message = "Upstream booking ID must not exceed 64 characters")
        String upstreamBookingId,

        @NotBlank(message = "Downstream booking ID is required")
        @Size(max = 64, message = "Downstream booking ID must not exceed 64 characters")
        String downstreamBookingId,

        @NotBlank(message = "Relationship type is required")
        @Size(max = 32, message = "Relationship type must not exceed 32 characters")
        String relationshipType,

        @Min(value = 0, message = "Required buffer minutes must be non-negative")
        Integer requiredBufferMinutes,

        @Size(max = 16, message = "Commitment type must not exceed 16 characters")
        String commitmentType,

        String description
) {
}
