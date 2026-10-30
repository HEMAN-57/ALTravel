package tech.altravel.auth.dto;

public record AuthResponse(
        String token,
        String tokenType,
        long expiresInMs,
        UserSummaryResponse user,
        UserProfileResponse profile
) {
    public static AuthResponse of(String token, long expiresInMs, UserSummaryResponse user, UserProfileResponse profile) {
        return new AuthResponse(token, "Bearer", expiresInMs, user, profile);
    }
}
