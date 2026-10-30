package tech.altravel.auth.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateProfileRequest(
        @Size(min = 2, max = 255, message = "Full name must be between 2 and 255 characters")
        String fullName,

        @Pattern(regexp = "^(INR|USD|EUR|GBP)$", message = "Currency must be one of INR, USD, EUR, GBP")
        String preferredCurrency,

        @Size(max = 512, message = "Avatar URL must not exceed 512 characters")
        String avatarUrl,

        @Pattern(regexp = "^(budget|balanced|splurge)$", message = "Cost sensitivity must be budget, balanced, or splurge")
        String costSensitivity,

        @Pattern(regexp = "^(relaxed|moderate|fast)$", message = "Preferred pace must be relaxed, moderate, or fast")
        String preferredPace,

        @Size(max = 64, message = "Primary priority must not exceed 64 characters")
        String primaryPriority,

        @DecimalMin(value = "0.0", message = "Willingness to pay speed must be between 0.0 and 1.0")
        @DecimalMax(value = "1.0", message = "Willingness to pay speed must be between 0.0 and 1.0")
        BigDecimal willingnessToPaySpeed
) {
}
