package tech.altravel.auth.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.altravel.auth.dto.AuthResponse;
import tech.altravel.auth.dto.ForgotPasswordRequest;
import tech.altravel.auth.dto.ForgotPasswordResponse;
import tech.altravel.auth.dto.LoginRequest;
import tech.altravel.auth.dto.RegisterRequest;
import tech.altravel.auth.dto.UpdateProfileRequest;
import tech.altravel.auth.dto.UserProfileResponse;
import tech.altravel.auth.dto.UserSummaryResponse;
import tech.altravel.common.error.ConflictException;
import tech.altravel.common.error.DomainValidationException;
import tech.altravel.common.error.ResourceNotFoundException;
import tech.altravel.security.domain.UserPrincipal;
import tech.altravel.security.jwt.JwtTokenService;
import tech.altravel.user.domain.UserEntity;
import tech.altravel.user.domain.UserProfileEntity;
import tech.altravel.user.domain.UserProfileRepository;
import tech.altravel.user.domain.UserRepository;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenService jwtTokenService;

    public AuthService(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtTokenService jwtTokenService) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtTokenService = jwtTokenService;
    }

    public AuthResponse register(RegisterRequest request) {
        String email = request.email().toLowerCase().trim();

        if (!request.password().equals(request.confirmPassword())) {
            throw new DomainValidationException("Password confirmation does not match password.");
        }

        if (!Boolean.TRUE.equals(request.termsAccepted())) {
            throw new DomainValidationException("You must accept the terms of service to create an account.");
        }

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("An account with email '" + email + "' already exists.");
        }

        String userId = "usr-" + UUID.randomUUID().toString().substring(0, 12);
        String profileId = "prof-" + UUID.randomUUID().toString().substring(0, 12);

        String passwordHash = passwordEncoder.encode(request.password());
        UserEntity user = new UserEntity(
                userId,
                email,
                passwordHash,
                request.fullName().trim(),
                "ROLE_USER"
        );

        UserProfileEntity profile = new UserProfileEntity(
                profileId,
                user,
                "INR",
                null,
                "balanced",
                "moderate",
                "preserve-activity",
                BigDecimal.valueOf(0.50)
        );
        user.setProfile(profile);

        UserEntity savedUser = userRepository.save(user);
        UserPrincipal principal = UserPrincipal.fromEntity(savedUser);
        String token = jwtTokenService.generateToken(principal);

        return AuthResponse.of(
                token,
                jwtTokenService.getExpirationMs(),
                UserSummaryResponse.fromEntity(savedUser),
                UserProfileResponse.fromEntity(savedUser.getProfile())
        );
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.email().toLowerCase().trim();

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password())
            );

            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            UserEntity user = userRepository.findById(principal.getId())
                    .orElseThrow(() -> new BadCredentialsException("Invalid email or password."));

            String token = jwtTokenService.generateToken(principal);

            return AuthResponse.of(
                    token,
                    jwtTokenService.getExpirationMs(),
                    UserSummaryResponse.fromEntity(user),
                    UserProfileResponse.fromEntity(user.getProfile())
            );
        } catch (BadCredentialsException ex) {
            // Never leak whether the email exists in the database
            throw new BadCredentialsException("Invalid email or password.");
        }
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String userId) {
        UserProfileEntity profile = userProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found for user ID: " + userId));
        return UserProfileResponse.fromEntity(profile);
    }

    public UserProfileResponse updateProfile(String userId, UpdateProfileRequest request) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + userId));

        if (request.fullName() != null && !request.fullName().trim().isEmpty()) {
            user.setFullName(request.fullName().trim());
        }

        UserProfileEntity profile = user.getProfile();
        if (profile == null) {
            String profileId = "prof-" + UUID.randomUUID().toString().substring(0, 12);
            profile = new UserProfileEntity(
                    profileId,
                    user,
                    "INR",
                    null,
                    "balanced",
                    "moderate",
                    "preserve-activity",
                    BigDecimal.valueOf(0.50)
            );
            user.setProfile(profile);
        }

        if (request.preferredCurrency() != null) {
            profile.setPreferredCurrency(request.preferredCurrency().trim().toUpperCase());
        }
        if (request.avatarUrl() != null) {
            profile.setAvatarUrl(request.avatarUrl().trim());
        }
        if (request.costSensitivity() != null) {
            profile.setCostSensitivity(request.costSensitivity().trim().toLowerCase());
        }
        if (request.preferredPace() != null) {
            profile.setPreferredPace(request.preferredPace().trim().toLowerCase());
        }
        if (request.primaryPriority() != null) {
            profile.setPrimaryPriority(request.primaryPriority().trim());
        }
        if (request.willingnessToPaySpeed() != null) {
            profile.setWillingnessToPaySpeed(request.willingnessToPaySpeed());
        }

        userRepository.save(user);
        return UserProfileResponse.fromEntity(profile);
    }

    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        // Enforce safe boundary for reset request
        return ForgotPasswordResponse.futureIntegrationBoundary(request.email().trim());
    }
}
