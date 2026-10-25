package tech.altravel.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tech.altravel.PostgresIntegrationTestBase;
import tech.altravel.booking.domain.BookingRepository;
import tech.altravel.dependency.domain.BookingDependencyRepository;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;
import tech.altravel.trip.dto.CreateTripRequest;
import tech.altravel.trip.dto.UpdateTripRequest;

import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class TripApiIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingDependencyRepository dependencyRepository;

    @BeforeEach
    void setupCleanDatabase() {
        dependencyRepository.deleteAll();
        bookingRepository.deleteAll();
        tripRepository.deleteAll();
    }

    @Test
    @DisplayName("POST /api/v1/trips creates trip and returns 201 Created")
    void createTripSuccess() throws Exception {
        CreateTripRequest request = new CreateTripRequest(
                "trip-kashmir-1",
                "Kashmir Valley Tour",
                "Delhi (DEL)",
                "Srinagar (SXR)",
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 7),
                false,
                "Scenic autumn tour of Dal Lake and Gulmarg."
        );

        mockMvc.perform(post("/api/v1/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", is("trip-kashmir-1")))
                .andExpect(jsonPath("$.name", is("Kashmir Valley Tour")))
                .andExpect(jsonPath("$.origin", is("Delhi (DEL)")))
                .andExpect(jsonPath("$.destination", is("Srinagar (SXR)")))
                .andExpect(jsonPath("$.startDate", is("2026-09-01")))
                .andExpect(jsonPath("$.endDate", is("2026-09-07")))
                .andExpect(jsonPath("$.isSample", is(false)))
                .andExpect(jsonPath("$.description", is("Scenic autumn tour of Dal Lake and Gulmarg.")));
    }

    @Test
    @DisplayName("POST /api/v1/trips generates ID when omitted")
    void createTripGeneratesId() throws Exception {
        CreateTripRequest request = new CreateTripRequest(
                null,
                "Kerala Backwaters",
                "Bangalore (BLR)",
                "Kochi (COK)",
                LocalDate.of(2026, 10, 5),
                LocalDate.of(2026, 10, 10),
                null,
                null
        );

        mockMvc.perform(post("/api/v1/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.name", is("Kerala Backwaters")))
                .andExpect(jsonPath("$.isSample", is(false)));
    }

    @Test
    @DisplayName("POST /api/v1/trips rejects duplicate ID with 409 Conflict")
    void createTripDuplicateIdRejected() throws Exception {
        TripEntity existing = new TripEntity(
                "trip-dup-id", "Existing Trip", "DEL", "BOM",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5), false, null
        );
        tripRepository.saveAndFlush(existing);

        CreateTripRequest request = new CreateTripRequest(
                "trip-dup-id", "Duplicate Trip", "DEL", "BOM",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5), false, null
        );

        mockMvc.perform(post("/api/v1/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("CONFLICT")))
                .andExpect(jsonPath("$.detail", containsString("already exists")));
    }

    @Test
    @DisplayName("POST /api/v1/trips rejects invalid dates (endDate < startDate) with 400 Bad Request")
    void createTripInvalidDateRange() throws Exception {
        CreateTripRequest request = new CreateTripRequest(
                "trip-invalid-dates",
                "Invalid Dates Trip",
                "DEL",
                "BOM",
                LocalDate.of(2026, 8, 10),
                LocalDate.of(2026, 8, 5),
                false,
                null
        );

        mockMvc.perform(post("/api/v1/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.detail", containsString("earlier than start date")));
    }

    @Test
    @DisplayName("POST /api/v1/trips rejects blank required fields with 400 Bad Request")
    void createTripMissingRequiredFields() throws Exception {
        CreateTripRequest request = new CreateTripRequest(
                null,
                "", // Blank name
                "", // Blank origin
                null, // Missing destination
                null, // Missing start date
                LocalDate.of(2026, 8, 5),
                false,
                null
        );

        mockMvc.perform(post("/api/v1/trips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_ARGUMENT")))
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.origin").exists())
                .andExpect(jsonPath("$.fieldErrors.destination").exists())
                .andExpect(jsonPath("$.fieldErrors.startDate").exists());
    }

    @Test
    @DisplayName("GET /api/v1/trips/{tripId} returns 200 and trip details")
    void getTripByIdSuccess() throws Exception {
        TripEntity trip = new TripEntity(
                "trip-find-1", "Find Me Trip", "HYD", "GOI",
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 5), true, "Demo test"
        );
        tripRepository.saveAndFlush(trip);

        mockMvc.perform(get("/api/v1/trips/{tripId}", "trip-find-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("trip-find-1")))
                .andExpect(jsonPath("$.name", is("Find Me Trip")))
                .andExpect(jsonPath("$.isSample", is(true)));
    }

    @Test
    @DisplayName("GET /api/v1/trips/{tripId} returns 404 for nonexistent ID")
    void getTripByIdNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/trips/{tripId}", "nonexistent-trip-999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.detail", containsString("nonexistent-trip-999")));
    }

    @Test
    @DisplayName("GET /api/v1/trips supports pagination and deterministic order")
    void getTripsPagination() throws Exception {
        TripEntity t1 = new TripEntity("t-1", "Trip 1", "A", "B", LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 5), false, null);
        TripEntity t2 = new TripEntity("t-2", "Trip 2", "A", "B", LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 5), false, null);
        TripEntity t3 = new TripEntity("t-3", "Trip 3", "A", "B", LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 5), false, null);
        tripRepository.saveAllAndFlush(List.of(t1, t2, t3));

        mockMvc.perform(get("/api/v1/trips")
                        .param("page", "0")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page", is(0)))
                .andExpect(jsonPath("$.size", is(2)))
                .andExpect(jsonPath("$.totalElements", is(3)))
                .andExpect(jsonPath("$.totalPages", is(2)))
                .andExpect(jsonPath("$.content", hasSize(2)));
    }

    @Test
    @DisplayName("GET /api/v1/trips rejects invalid page parameters with 400 Bad Request")
    void getTripsInvalidPaginationParams() throws Exception {
        mockMvc.perform(get("/api/v1/trips")
                        .param("page", "-1")
                        .param("size", "20"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")));

        mockMvc.perform(get("/api/v1/trips")
                        .param("page", "0")
                        .param("size", "150"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")));
    }

    @Test
    @DisplayName("PUT /api/v1/trips/{tripId} updates trip and returns 200 OK")
    void updateTripSuccess() throws Exception {
        TripEntity trip = new TripEntity(
                "trip-up-1", "Original Name", "DEL", "BOM",
                LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 5), false, "Old notes"
        );
        tripRepository.saveAndFlush(trip);

        UpdateTripRequest update = new UpdateTripRequest(
                "Updated Name",
                "Delhi (DEL)",
                "Mumbai (BOM)",
                LocalDate.of(2026, 5, 2),
                LocalDate.of(2026, 5, 7),
                true,
                "New notes"
        );

        mockMvc.perform(put("/api/v1/trips/{tripId}", "trip-up-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Updated Name")))
                .andExpect(jsonPath("$.startDate", is("2026-05-02")))
                .andExpect(jsonPath("$.endDate", is("2026-05-07")))
                .andExpect(jsonPath("$.isSample", is(true)))
                .andExpect(jsonPath("$.description", is("New notes")));
    }

    @Test
    @DisplayName("PUT /api/v1/trips/{tripId} returns 404 for nonexistent ID")
    void updateTripNotFound() throws Exception {
        UpdateTripRequest update = new UpdateTripRequest(
                "Name", "DEL", "BOM", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 5), false, null
        );

        mockMvc.perform(put("/api/v1/trips/{tripId}", "nonexistent-trip-999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")));
    }

    @Test
    @DisplayName("DELETE /api/v1/trips/{tripId} deletes trip and returns 204 No Content")
    void deleteTripSuccess() throws Exception {
        TripEntity trip = new TripEntity(
                "trip-del-1", "To Be Deleted", "DEL", "BOM",
                LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 5), false, null
        );
        tripRepository.saveAndFlush(trip);

        mockMvc.perform(delete("/api/v1/trips/{tripId}", "trip-del-1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/trips/{tripId}", "trip-del-1"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("DELETE /api/v1/trips/{tripId} returns 404 for nonexistent ID")
    void deleteTripNotFound() throws Exception {
        mockMvc.perform(delete("/api/v1/trips/{tripId}", "nonexistent-trip-999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")));
    }
}
