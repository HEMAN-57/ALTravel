package tech.altravel.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tech.altravel.PostgresIntegrationTestBase;
import tech.altravel.auth.dto.AuthResponse;
import tech.altravel.auth.dto.ForgotPasswordRequest;
import tech.altravel.auth.dto.LoginRequest;
import tech.altravel.auth.dto.RegisterRequest;
import tech.altravel.auth.dto.UpdateProfileRequest;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
public class AuthApiIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("POST /api/auth/register creates user and returns JWT token and user profile")
    void shouldRegisterNewUserSuccessfully() throws Exception {
        String email = "traveler_" + UUID.randomUUID().toString().substring(0, 8) + "@tripsync.io";
        RegisterRequest request = new RegisterRequest(
                "Siddharth Verma",
                email,
                "StrongPass123",
                "StrongPass123",
                true
        );

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(cookie().exists("tripsync_token"))
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.email").value(email.toLowerCase()))
                .andExpect(jsonPath("$.user.fullName").value("Siddharth Verma"))
                .andExpect(jsonPath("$.profile.preferredCurrency").value("INR"))
                .andReturn();

        AuthResponse authResponse = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                AuthResponse.class
        );
        assertThat(authResponse.token()).isNotBlank();
        assertThat(authResponse.user().id()).startsWith("usr-");
    }

    @Test
    @DisplayName("POST /api/auth/register rejects duplicate email address with 409 Conflict")
    void shouldRejectDuplicateEmailRegistration() throws Exception {
        String email = "duplicate_" + UUID.randomUUID().toString().substring(0, 8) + "@tripsync.io";
        RegisterRequest request = new RegisterRequest(
                "User One",
                email,
                "Password123",
                "Password123",
                true
        );

        // First registration succeeds
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        // Duplicate registration fails with 409
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    @DisplayName("POST /api/auth/register validates password match and strength")
    void shouldValidatePasswordRules() throws Exception {
        // Password mismatch
        RegisterRequest mismatch = new RegisterRequest(
                "User Test",
                "mismatch@tripsync.io",
                "Pass1234",
                "Pass5678",
                true
        );
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mismatch)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // Weak password (no number)
        RegisterRequest weak = new RegisterRequest(
                "User Test",
                "weak@tripsync.io",
                "passwordonly",
                "passwordonly",
                true
        );
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(weak)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/auth/login succeeds with valid credentials and fails on invalid credentials")
    void shouldAuthenticateUserOnLogin() throws Exception {
        String email = "login_test_" + UUID.randomUUID().toString().substring(0, 8) + "@tripsync.io";
        RegisterRequest regRequest = new RegisterRequest(
                "Login Tester",
                email,
                "SecureLogin123",
                "SecureLogin123",
                true
        );
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regRequest)))
                .andExpect(status().isCreated());

        // Successful login
        LoginRequest validLogin = new LoginRequest(email, "SecureLogin123", true);
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validLogin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.email").value(email.toLowerCase()));

        // Invalid password returns 401
        LoginRequest invalidPass = new LoginRequest(email, "WrongPass123", false);
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidPass)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("BAD_CREDENTIALS"));

        // Non-existent email returns 401 without leaking user existence
        LoginRequest nonExistent = new LoginRequest("unknown_user@tripsync.io", "Pass123", false);
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(nonExistent)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("BAD_CREDENTIALS"));
    }

    @Test
    @DisplayName("Protected endpoint /api/users/profile rejects unauthenticated request and allows authenticated access")
    void shouldProtectUserProfileEndpoint() throws Exception {
        // Unauthenticated request receives 401
        mockMvc.perform(get("/api/users/profile"))
                .andExpect(status().isUnauthorized());

        // Register user to get JWT token
        String email = "profile_user_" + UUID.randomUUID().toString().substring(0, 8) + "@tripsync.io";
        RegisterRequest regRequest = new RegisterRequest(
                "Profile Traveler",
                email,
                "SecurePass123",
                "SecurePass123",
                true
        );
        MvcResult regResult = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regRequest)))
                .andExpect(status().isCreated())
                .andReturn();

        AuthResponse auth = objectMapper.readValue(
                regResult.getResponse().getContentAsString(),
                AuthResponse.class
        );

        // Authenticated GET profile
        mockMvc.perform(get("/api/users/profile")
                        .header("Authorization", "Bearer " + auth.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferredCurrency").value("INR"))
                .andExpect(jsonPath("$.costSensitivity").value("balanced"));

        // Authenticated PUT profile
        UpdateProfileRequest updateReq = new UpdateProfileRequest(
                "Profile Traveler Updated",
                "EUR",
                "https://avatar.example.com/user.png",
                "splurge",
                "fast",
                "earliest-arrival",
                BigDecimal.valueOf(0.85)
        );
        mockMvc.perform(put("/api/users/profile")
                        .header("Authorization", "Bearer " + auth.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferredCurrency").value("EUR"))
                .andExpect(jsonPath("$.costSensitivity").value("splurge"))
                .andExpect(jsonPath("$.preferredPace").value("fast"));
    }

    @Test
    @DisplayName("POST /api/auth/forgot-password returns clearly labelled future boundary")
    void shouldHandleForgotPasswordWithSafeBoundary() throws Exception {
        ForgotPasswordRequest request = new ForgotPasswordRequest("user@tripsync.io");
        mockMvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.deliveryChannel").value("pending_provider_configuration"));
    }
}
