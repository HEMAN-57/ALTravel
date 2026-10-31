package tech.altravel.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tech.altravel.PostgresIntegrationTestBase;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
public class CorsAndActuatorSecurityIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Direct GET /actuator/health returns 200 OK with UP status")
    void shouldReturn200OnDirectActuatorHealth() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Cross-origin GET /actuator/health allows arbitrary origin without 403 Invalid CORS")
    void shouldAllowCrossOriginHealthProbesFromAnyOrigin() throws Exception {
        mockMvc.perform(get("/actuator/health")
                        .header("Origin", "https://tripsync-frontend-8h9q.onrender.com"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"))
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/health")
                        .header("Origin", "https://monitoring.uptime-service.io"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"))
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Cross-origin OPTIONS preflight to /actuator/health succeeds")
    void shouldAllowOptionsPreflightOnActuatorHealth() throws Exception {
        mockMvc.perform(options("/actuator/health")
                        .header("Origin", "https://tripsync-frontend-8h9q.onrender.com")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Access-Control-Allow-Origin"));
    }

    @Test
    @DisplayName("OPTIONS preflight to /api/auth/login allows Render frontend pattern with credentials")
    void shouldAllowCrossOriginPreflightOnAuthFromRenderOrigin() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .header("Origin", "https://tripsync-frontend-8h9q.onrender.com")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type,Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://tripsync-frontend-8h9q.onrender.com"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    @DisplayName("OPTIONS preflight to /api/auth/login rejects unlisted malicious origin with 403")
    void shouldRejectCrossOriginPreflightFromDisallowedOrigin() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .header("Origin", "https://unauthorized-attacker-site.com")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/auth/login with Render Origin executes without CORS rejection")
    void shouldProcessLoginFromRenderOrigin() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .header("Origin", "https://tripsync-frontend-8h9q.onrender.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nonexistent@tripsync.io\",\"password\":\"WrongPassword123\",\"rememberMe\":false}"))
                .andExpect(status().isUnauthorized()) // 401 Bad credentials, NOT 403 CORS rejection!
                .andExpect(header().string("Access-Control-Allow-Origin", "https://tripsync-frontend-8h9q.onrender.com"))
                .andExpect(jsonPath("$.code").value("BAD_CREDENTIALS"));
    }
}

