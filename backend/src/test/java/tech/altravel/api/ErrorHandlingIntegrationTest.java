package tech.altravel.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tech.altravel.PostgresIntegrationTestBase;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class ErrorHandlingIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Malformed JSON syntax returns 400 Bad Request with ProblemDetail and no stack trace")
    void malformedJsonPayloadReturnsProblemDetail() throws Exception {
        String malformedJson = "{ \"name\": \"Broken JSON... ";

        mockMvc.perform(post("/api/v1/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(malformedJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.title", is("Malformed Request Payload")))
                .andExpect(jsonPath("$.code", is("MALFORMED_JSON")))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.stackTrace").doesNotExist())
                .andExpect(jsonPath("$.detail", not(containsString("org.springframework"))));
    }

    @Test
    @DisplayName("Unparseable date value returns 400 Bad Request with ProblemDetail")
    void unparseableDateValueReturnsProblemDetail() throws Exception {
        String invalidDateJson = """
                {
                    "name": "Trip with Invalid Date",
                    "origin": "DEL",
                    "destination": "BOM",
                    "startDate": "not-a-valid-date-format",
                    "endDate": "2026-10-10"
                }
                """;

        mockMvc.perform(post("/api/v1/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidDateJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.code", is("MALFORMED_JSON")))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.stackTrace").doesNotExist());
    }
}
