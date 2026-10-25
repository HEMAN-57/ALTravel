package tech.altravel.trip.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateTripRequest(
        @Size(max = 64, message = "Trip ID must not exceed 64 characters")
        String id,

        @NotBlank(message = "Trip name is required")
        @Size(max = 255, message = "Trip name must not exceed 255 characters")
        String name,

        @NotBlank(message = "Trip origin is required")
        @Size(max = 128, message = "Trip origin must not exceed 128 characters")
        String origin,

        @NotBlank(message = "Trip destination is required")
        @Size(max = 128, message = "Trip destination must not exceed 128 characters")
        String destination,

        @NotNull(message = "Trip start date is required")
        LocalDate startDate,

        @NotNull(message = "Trip end date is required")
        LocalDate endDate,

        Boolean isSample,

        String description
) {
}
