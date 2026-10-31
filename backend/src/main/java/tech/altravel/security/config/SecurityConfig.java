package tech.altravel.security.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tech.altravel.security.jwt.JwtAuthenticationFilter;
import tech.altravel.security.service.UserDetailsServiceImpl;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsServiceImpl userDetailsService;
    private final List<String> allowedOrigins;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            UserDetailsServiceImpl userDetailsService,
            @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://*.onrender.com}") String allowedOriginsStr) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userDetailsService = userDetailsService;
        this.allowedOrigins = Arrays.stream(allowedOriginsStr.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.getWriter().write(
                                    "{\"type\":\"urn:problem-type:unauthorized\",\"title\":\"Unauthorized\",\"status\":401,\"detail\":\"Full authentication is required to access this resource.\",\"code\":\"UNAUTHORIZED\"}"
                            );
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.getWriter().write(
                                    "{\"type\":\"urn:problem-type:forbidden\",\"title\":\"Forbidden\",\"status\":403,\"detail\":\"You do not have permission to access this resource.\",\"code\":\"FORBIDDEN\"}"
                            );
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        // Public Authentication endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        // Public Demo seed & Actuator endpoints
                        .requestMatchers("/api/demo/**", "/api/v1/demo/**", "/actuator/**").permitAll()
                        // Public read access for sample trips and public itineraries
                        .requestMatchers(HttpMethod.GET, "/api/trips/**", "/api/v1/trips/**").permitAll()
                        // Public demonstration trip and itinerary mutation endpoints (trip ownership enforced by TripService for private trips)
                        .requestMatchers(HttpMethod.POST, "/api/v1/trips/**", "/api/v1/demo/**").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/v1/trips/**").permitAll()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/trips/**").permitAll()
                        // Protected Profile endpoints
                        .requestMatchers("/api/users/**").authenticated()
                        // Explicitly require authentication for any other unmapped endpoints rather than wildcard permit-all
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

        // 1. Safe, uncredentialed public CORS configuration for Actuator endpoints (health, info)
        // Allows unauthenticated GET and OPTIONS probes from any origin without exposing credentials or internal APIs
        CorsConfiguration healthCors = new CorsConfiguration();
        healthCors.addAllowedOriginPattern("*");
        healthCors.setAllowedMethods(List.of("GET", "OPTIONS"));
        healthCors.setAllowedHeaders(List.of("Accept", "Content-Type", "Origin"));
        healthCors.setAllowCredentials(false);
        healthCors.setMaxAge(3600L);
        source.registerCorsConfiguration("/actuator/**", healthCors);

        // 2. Strict, credentialed CORS configuration for application APIs (/api/**)
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin"));
        configuration.setExposedHeaders(List.of("Authorization", "Set-Cookie"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
