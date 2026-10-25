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
import tech.altravel.booking.domain.BookingEntity;
import tech.altravel.booking.domain.BookingRepository;
import tech.altravel.booking.dto.CreateBookingRequest;
import tech.altravel.booking.dto.UpdateBookingRequest;
import tech.altravel.dependency.domain.BookingDependencyEntity;
import tech.altravel.dependency.domain.BookingDependencyRepository;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class BookingApiIntegrationTest extends PostgresIntegrationTestBase {

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

    private TripEntity tripA;
    private TripEntity tripB;

    @BeforeEach
    void setupTrips() {
        dependencyRepository.deleteAll();
        bookingRepository.deleteAll();
        tripRepository.deleteAll();

        tripA = new TripEntity(
                "trip-a", "Trip A", "DEL", "BOM",
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 5), false, null
        );
        tripB = new TripEntity(
                "trip-b", "Trip B", "BLR", "GOI",
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 5), false, null
        );
        tripRepository.saveAllAndFlush(List.of(tripA, tripB));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/bookings creates booking and returns 201 Created")
    void createBookingSuccess() throws Exception {
        CreateBookingRequest request = new CreateBookingRequest(
                "book-flight-a1",
                "flight",
                "IndiGo 6E-201",
                "DEL -> BOM",
                Instant.parse("2026-11-01T06:00:00Z"),
                Instant.parse("2026-11-01T08:15:00Z"),
                new BigDecimal("4500.00"),
                "INR",
                "confirmed",
                Instant.parse("2026-11-01T04:00:00Z"),
                Instant.parse("2026-11-01T05:00:00Z"),
                "Standard cancellation policy",
                "Web check-in completed",
                "PNR-IND-100"
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/bookings", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", is("book-flight-a1")))
                .andExpect(jsonPath("$.tripId", is("trip-a")))
                .andExpect(jsonPath("$.type", is("flight")))
                .andExpect(jsonPath("$.provider", is("IndiGo 6E-201")))
                .andExpect(jsonPath("$.cost", is(4500.0)))
                .andExpect(jsonPath("$.currency", is("INR")))
                .andExpect(jsonPath("$.confirmationReference", is("PNR-IND-100")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/bookings returns 404 for nonexistent trip")
    void createBookingTripNotFound() throws Exception {
        CreateBookingRequest request = new CreateBookingRequest(
                "book-err", "hotel", "Resort", "Goa",
                null, null, new BigDecimal("2000.00"), "INR", "confirmed",
                null, null, null, null, null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/bookings", "nonexistent-trip-999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/bookings rejects transport without startTime with 400 Bad Request")
    void createTransportBookingWithoutStartTimeRejected() throws Exception {
        CreateBookingRequest request = new CreateBookingRequest(
                "book-trans-no-time", "flight", "Air India", "DEL -> BOM",
                null, // Missing startTime for flight
                null, new BigDecimal("5000.00"), "INR", "confirmed",
                null, null, null, null, null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/bookings", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.detail", containsString("Start time is required for transport bookings")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/bookings accepts lodging without startTime")
    void createLodgingWithoutStartTimeAccepted() throws Exception {
        CreateBookingRequest request = new CreateBookingRequest(
                "book-hotel-no-time", "hotel", "Taj Mahal Palace", "Mumbai",
                null, null, new BigDecimal("15000.00"), "INR", "confirmed",
                null, null, null, null, null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/bookings", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", is("book-hotel-no-time")))
                .andExpect(jsonPath("$.startTime", nullValue()))
                .andExpect(jsonPath("$.endTime", nullValue()));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/bookings rejects endTime before startTime")
    void createBookingEndTimeBeforeStartTimeRejected() throws Exception {
        CreateBookingRequest request = new CreateBookingRequest(
                "book-bad-times", "hotel", "Resort", "Mumbai",
                Instant.parse("2026-11-02T12:00:00Z"),
                Instant.parse("2026-11-01T12:00:00Z"), // Earlier than start time
                new BigDecimal("3000.00"), "INR", "confirmed",
                null, null, null, null, null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/bookings", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.detail", containsString("End time cannot precede start time")));
    }

    @Test
    @DisplayName("GET /api/v1/trips/{tripId}/bookings returns all bookings for the specified trip")
    void getBookingsByTripIdSuccess() throws Exception {
        BookingEntity b1 = new BookingEntity("b1", tripA, "flight", "Air India", "DEL -> BOM",
                Instant.parse("2026-11-01T06:00:00Z"), null, new BigDecimal("4000.00"), "INR", "confirmed");
        BookingEntity b2 = new BookingEntity("b2", tripA, "hotel", "Taj Hotel", "Mumbai",
                null, null, new BigDecimal("10000.00"), "INR", "confirmed");
        bookingRepository.saveAllAndFlush(List.of(b1, b2));

        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].tripId", is("trip-a")))
                .andExpect(jsonPath("$[1].tripId", is("trip-a")));
    }

    @Test
    @DisplayName("Cross-trip access rejection: GET /api/v1/trips/{tripId}/bookings/{bookingId} returns 404 when booking belongs to another trip")
    void getBookingCrossTripRejection() throws Exception {
        BookingEntity bookingInTripA = new BookingEntity("b-trip-a", tripA, "hotel", "Hotel A", "DEL",
                null, null, new BigDecimal("2000.00"), "INR", "confirmed");
        bookingRepository.saveAndFlush(bookingInTripA);

        // Access booking from Trip A using Trip B's URL
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-b", "b-trip-a"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.detail", containsString("not found for trip 'trip-b'")));
    }

    @Test
    @DisplayName("Cross-trip update rejection: PUT /api/v1/trips/{tripId}/bookings/{bookingId} returns 404 when booking belongs to another trip")
    void updateBookingCrossTripRejection() throws Exception {
        BookingEntity bookingInTripA = new BookingEntity("b-trip-a2", tripA, "hotel", "Hotel A", "DEL",
                null, null, new BigDecimal("2000.00"), "INR", "confirmed");
        bookingRepository.saveAndFlush(bookingInTripA);

        UpdateBookingRequest update = new UpdateBookingRequest(
                "hotel", "Modified Hotel", "DEL", null, null,
                new BigDecimal("2500.00"), "INR", "confirmed",
                null, null, null, null, null
        );

        // Attempt update using Trip B's URL
        mockMvc.perform(put("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-b", "b-trip-a2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")));
    }

    @Test
    @DisplayName("Cross-trip delete rejection: DELETE /api/v1/trips/{tripId}/bookings/{bookingId} returns 404 when booking belongs to another trip")
    void deleteBookingCrossTripRejection() throws Exception {
        BookingEntity bookingInTripA = new BookingEntity("b-trip-a3", tripA, "hotel", "Hotel A", "DEL",
                null, null, new BigDecimal("2000.00"), "INR", "confirmed");
        bookingRepository.saveAndFlush(bookingInTripA);

        // Attempt deletion using Trip B's URL
        mockMvc.perform(delete("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-b", "b-trip-a3"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")));

        // Verify booking was NOT deleted
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-trip-a3"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PUT /api/v1/trips/{tripId}/bookings/{bookingId} updates booking and preserves nullability")
    void updateBookingSuccess() throws Exception {
        BookingEntity b = new BookingEntity("b-up-1", tripA, "hotel", "Old Hotel", "DEL",
                Instant.parse("2026-11-01T12:00:00Z"), null, new BigDecimal("3000.00"), "INR", "confirmed");
        b.setNotes("Old Notes");
        bookingRepository.saveAndFlush(b);

        UpdateBookingRequest update = new UpdateBookingRequest(
                "hotel", "New Hotel", "South Mumbai",
                null, // Clearing startTime
                null,
                new BigDecimal("3500.00"), "INR", "confirmed",
                null, null, null, null, null // Clearing notes
        );

        mockMvc.perform(put("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-up-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider", is("New Hotel")))
                .andExpect(jsonPath("$.location", is("South Mumbai")))
                .andExpect(jsonPath("$.startTime", nullValue()))
                .andExpect(jsonPath("$.notes", nullValue()));
    }

    @Test
    @DisplayName("DELETE /api/v1/trips/{tripId}/bookings/{bookingId} deletes booking and returns 204 No Content")
    void deleteBookingSuccess() throws Exception {
        BookingEntity b = new BookingEntity("b-del-1", tripA, "activity", "City Tour", "DEL",
                null, null, new BigDecimal("1000.00"), "INR", "confirmed");
        bookingRepository.saveAndFlush(b);

        mockMvc.perform(delete("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-del-1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-del-1"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("DELETE /api/v1/trips/{tripId}/bookings/{bookingId} cascades to remove affected dependencies while preserving unrelated bookings and dependencies")
    void deleteBookingCascadesToDependenciesAndPreservesUnrelatedEntities() throws Exception {
        // Create 4 bookings in Trip A: b1 (to be deleted), b2, b3, b4
        BookingEntity b1 = new BookingEntity("b-cascade-1", tripA, "flight", "Air India", "DEL -> BOM",
                null, null, new BigDecimal("4000.00"), "INR", "confirmed");
        BookingEntity b2 = new BookingEntity("b-cascade-2", tripA, "hotel", "Taj Palace", "BOM",
                null, null, new BigDecimal("12000.00"), "INR", "confirmed");
        BookingEntity b3 = new BookingEntity("b-cascade-3", tripA, "activity", "Harbour Cruise", "BOM",
                null, null, new BigDecimal("2500.00"), "INR", "confirmed");
        BookingEntity b4 = new BookingEntity("b-cascade-4", tripA, "train", "Vande Bharat", "BOM -> GOI",
                null, null, new BigDecimal("1500.00"), "INR", "confirmed");
        bookingRepository.saveAllAndFlush(List.of(b1, b2, b3, b4));

        // Create dependencies involving b1 (as upstream and downstream) plus an unrelated dependency:
        // dep1: b1 -> b2 (b1 is upstream)
        // dep2: b3 -> b1 (b1 is downstream)
        // dep3: b2 -> b4 (unrelated to b1)
        BookingDependencyEntity dep1 = new BookingDependencyEntity(
                "dep-cascade-up", tripA, "b-cascade-1", "b-cascade-2",
                "arrival-to-lodging", 90, "flexible", "Flight to Hotel"
        );
        BookingDependencyEntity dep2 = new BookingDependencyEntity(
                "dep-cascade-down", tripA, "b-cascade-3", "b-cascade-1",
                "transit-connection", 60, "hard", "Cruise to Flight"
        );
        BookingDependencyEntity dep3 = new BookingDependencyEntity(
                "dep-cascade-unrelated", tripA, "b-cascade-2", "b-cascade-4",
                "arrival-to-activity", 45, "hard", "Hotel to Train"
        );
        dependencyRepository.saveAllAndFlush(List.of(dep1, dep2, dep3));

        // Verify initial state: 4 bookings and 3 dependencies in trip-a
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)));
        mockMvc.perform(get("/api/v1/trips/{tripId}/dependencies", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));

        // Delete b1 via HTTP API
        mockMvc.perform(delete("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-cascade-1"))
                .andExpect(status().isNoContent());

        // Verify b1 is deleted (404 Not Found)
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-cascade-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")));

        // Verify unrelated bookings (b2, b3, b4) remain intact
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-cascade-2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("b-cascade-2")));
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-cascade-3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("b-cascade-3")));
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings/{bookingId}", "trip-a", "b-cascade-4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is("b-cascade-4")));

        // Verify booking collection for trip-a now has exactly 3 bookings
        mockMvc.perform(get("/api/v1/trips/{tripId}/bookings", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));

        // Verify dependencies collection for trip-a:
        // dep1 and dep2 were removed via ON DELETE CASCADE; dep3 remains intact
        mockMvc.perform(get("/api/v1/trips/{tripId}/dependencies", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is("dep-cascade-unrelated")))
                .andExpect(jsonPath("$[0].upstreamBookingId", is("b-cascade-2")))
                .andExpect(jsonPath("$[0].downstreamBookingId", is("b-cascade-4")));

        // Verify database state directly
        assertThat(bookingRepository.existsById("b-cascade-1")).isFalse();
        assertThat(bookingRepository.existsById("b-cascade-2")).isTrue();
        assertThat(bookingRepository.existsById("b-cascade-3")).isTrue();
        assertThat(bookingRepository.existsById("b-cascade-4")).isTrue();
        assertThat(dependencyRepository.existsById("dep-cascade-up")).isFalse();
        assertThat(dependencyRepository.existsById("dep-cascade-down")).isFalse();
        assertThat(dependencyRepository.existsById("dep-cascade-unrelated")).isTrue();
    }
}
