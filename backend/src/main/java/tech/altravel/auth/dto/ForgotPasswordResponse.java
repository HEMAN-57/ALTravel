package tech.altravel.auth.dto;

public record ForgotPasswordResponse(
        boolean success,
        String message,
        String deliveryChannel,
        String notice
) {
    public static ForgotPasswordResponse futureIntegrationBoundary(String email) {
        return new ForgotPasswordResponse(
                true,
                "Password reset request received for " + email + ".",
                "pending_provider_configuration",
                "Email delivery provider is pending SMTP/SendGrid configuration in this environment. In this prototype, please contact your workspace administrator or register a new demonstration account."
        );
    }
}
