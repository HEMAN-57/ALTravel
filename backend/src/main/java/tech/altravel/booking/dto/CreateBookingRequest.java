package tech.altravel.booking.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

public record CreateBookingRequest(
        @Size(max = 64, message = "Booking ID must not exceed 64 characters")
        String id,

        @NotBlank(message = "Booking type is required")
        @Size(max = 32, message = "Booking type must not exceed 32 characters")
        String type,

        @NotBlank(message = "Provider name is required")
        @Size(max = 255, message = "Provider must not exceed 255 characters")
        String provider,

        @NotBlank(message = "Location is required")
        @Size(max = 255, message = "Location must not exceed 255 characters")
        String location,

        Instant startTime,

        Instant endTime,

        @NotNull(message = "Booking cost is required")
        @DecimalMin(value = "0.00", message = "Booking cost must be non-negative")
        BigDecimal cost,

        @Size(min = 3, max = 3, message = "Currency must be a 3-letter ISO code")
        String currency,

        @Size(max = 32, message = "Status must not exceed 32 characters")
        String status,

        Instant cancellationDeadline,

        Instant arrivalDeadline,

        String cancellationPolicyNotes,

        String notes,

        @Size(max = 64, message = "Confirmation reference must not exceed 64 characters")
        String confirmationReference
) {
}
