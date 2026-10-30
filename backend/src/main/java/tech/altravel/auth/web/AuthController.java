package tech.altravel.auth.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.altravel.auth.dto.AuthResponse;
import tech.altravel.auth.dto.ForgotPasswordRequest;
import tech.altravel.auth.dto.ForgotPasswordResponse;
import tech.altravel.auth.dto.LoginRequest;
import tech.altravel.auth.dto.RegisterRequest;
import tech.altravel.auth.dto.UserProfileResponse;
import tech.altravel.auth.dto.UserSummaryResponse;
import tech.altravel.auth.service.AuthService;
import tech.altravel.security.domain.UserPrincipal;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.register(request);
        setAuthCookie(response, authResponse.token(), authResponse.expiresInMs() / 1000);
        return ResponseEntity.status(HttpStatus.CREATED).body(authResponse);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        long maxAge = Boolean.TRUE.equals(request.rememberMe()) ? (30 * 24 * 3600) : (authResponse.expiresInMs() / 1000);
        setAuthCookie(response, authResponse.token(), maxAge);
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("tripsync_token", "");
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // set to true in production with HTTPS
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Not authenticated"));
        }
        UserProfileResponse profile = authService.getProfile(principal.getId());
        UserSummaryResponse user = new UserSummaryResponse(
                principal.getId(),
                principal.getUsername(),
                principal.getFullName(),
                principal.getRole(),
                profile.createdAt()
        );
        return ResponseEntity.ok(Map.of("user", user, "profile", profile));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        ForgotPasswordResponse response = authService.forgotPassword(request);
        return ResponseEntity.ok(response);
    }

    private void setAuthCookie(HttpServletResponse response, String token, long maxAgeSeconds) {
        Cookie cookie = new Cookie("tripsync_token", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Set to true in prod HTTPS
        cookie.setPath("/");
        cookie.setMaxAge((int) maxAgeSeconds);
        response.addCookie(cookie);
    }
}
