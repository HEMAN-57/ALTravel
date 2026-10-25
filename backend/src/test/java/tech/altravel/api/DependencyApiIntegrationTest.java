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
import tech.altravel.dependency.domain.BookingDependencyEntity;
import tech.altravel.dependency.domain.BookingDependencyRepository;
import tech.altravel.dependency.dto.CreateDependencyRequest;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class DependencyApiIntegrationTest extends PostgresIntegrationTestBase {

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
    private BookingEntity bA1;
    private BookingEntity bA2;
    private BookingEntity bA3;
    private BookingEntity bB1;

    @BeforeEach
    void setupTripsAndBookings() {
        dependencyRepository.deleteAll();
        bookingRepository.deleteAll();
        tripRepository.deleteAll();

        tripA = new TripEntity("trip-a", "Trip A", "DEL", "BOM", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5), false, null);
        tripB = new TripEntity("trip-b", "Trip B", "BLR", "GOI", LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5), false, null);
        tripRepository.saveAllAndFlush(List.of(tripA, tripB));

        bA1 = new BookingEntity("b-a1", tripA, "flight", "Air India", "DEL -> BOM", null, null, new BigDecimal("4000.00"), "INR", "confirmed");
        bA2 = new BookingEntity("b-a2", tripA, "hotel", "Taj Mahal Palace", "Mumbai", null, null, new BigDecimal("12000.00"), "INR", "confirmed");
        bA3 = new BookingEntity("b-a3", tripA, "activity", "Harbour Cruise", "Mumbai", null, null, new BigDecimal("2500.00"), "INR", "confirmed");
        bB1 = new BookingEntity("b-b1", tripB, "flight", "Akasa Air", "BLR -> GOI", null, null, new BigDecimal("3500.00"), "INR", "confirmed");
        bookingRepository.saveAllAndFlush(List.of(bA1, bA2, bA3, bB1));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/dependencies creates dependency and returns 201 Created")
    void createDependencySuccess() throws Exception {
        CreateDependencyRequest request = new CreateDependencyRequest(
                "dep-1",
                "b-a1",
                "b-a2",
                "arrival-to-lodging",
                90,
                "flexible",
                "Airport egress to hotel check-in"
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", is("dep-1")))
                .andExpect(jsonPath("$.tripId", is("trip-a")))
                .andExpect(jsonPath("$.upstreamBookingId", is("b-a1")))
                .andExpect(jsonPath("$.downstreamBookingId", is("b-a2")))
                .andExpect(jsonPath("$.relationshipType", is("arrival-to-lodging")))
                .andExpect(jsonPath("$.requiredBufferMinutes", is(90)))
                .andExpect(jsonPath("$.commitmentType", is("flexible")))
                .andExpect(jsonPath("$.description", is("Airport egress to hotel check-in")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/dependencies rejects self-dependency with 400 Bad Request")
    void createSelfDependencyRejected() throws Exception {
        CreateDependencyRequest request = new CreateDependencyRequest(
                "dep-self",
                "b-a1",
                "b-a1", // Same booking as upstream and downstream
                "transit-connection",
                60,
                "hard",
                null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.detail", containsString("cannot depend on itself")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/dependencies rejects cross-trip booking references with 400 Bad Request")
    void createCrossTripDependencyRejected() throws Exception {
        CreateDependencyRequest request = new CreateDependencyRequest(
                "dep-cross",
                "b-a1",
                "b-b1", // Booking from trip B
                "transit-connection",
                60,
                "hard",
                null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.detail", containsString("does not belong to trip 'trip-a'")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/dependencies rejects negative buffer with 400 Bad Request")
    void createNegativeBufferDependencyRejected() throws Exception {
        CreateDependencyRequest request = new CreateDependencyRequest(
                "dep-neg",
                "b-a1",
                "b-a2",
                "transit-connection",
                -15, // Negative buffer
                "hard",
                null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("INVALID_ARGUMENT")))
                .andExpect(jsonPath("$.fieldErrors.requiredBufferMinutes").exists());
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/dependencies rejects duplicate dependency pair with 409 Conflict")
    void createDuplicateDependencyRejected() throws Exception {
        BookingDependencyEntity dep = new BookingDependencyEntity(
                "dep-orig", tripA, "b-a1", "b-a2", "arrival-to-lodging", 60, "hard", null
        );
        dependencyRepository.saveAndFlush(dep);

        CreateDependencyRequest duplicate = new CreateDependencyRequest(
                "dep-dup",
                "b-a1",
                "b-a2", // Same pair in trip A
                "arrival-to-lodging",
                90,
                "flexible",
                null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicate)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("CONFLICT")))
                .andExpect(jsonPath("$.detail", containsString("Duplicate dependency")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/dependencies rejects direct cycle (A -> B, then B -> A) with 409 Conflict")
    void createDirectCycleRejected() throws Exception {
        // Create A -> B
        BookingDependencyEntity dep1 = new BookingDependencyEntity(
                "dep-ab", tripA, "b-a1", "b-a2", "transit-connection", 60, "hard", null
        );
        dependencyRepository.saveAndFlush(dep1);

        // Attempt B -> A (creates direct cycle A -> B -> A)
        CreateDependencyRequest cycleRequest = new CreateDependencyRequest(
                "dep-ba",
                "b-a2",
                "b-a1",
                "transit-connection",
                60,
                "hard",
                null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cycleRequest)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("CONFLICT")))
                .andExpect(jsonPath("$.detail", containsString("Dependency cycle detected involving bookings")));
    }

    @Test
    @DisplayName("POST /api/v1/trips/{tripId}/dependencies rejects indirect cycle (A -> B -> C, then C -> A) with 409 Conflict")
    void createIndirectCycleRejected() throws Exception {
        // Create A -> B and B -> C
        BookingDependencyEntity depAB = new BookingDependencyEntity(
                "dep-ab", tripA, "b-a1", "b-a2", "transit-connection", 60, "hard", null
        );
        BookingDependencyEntity depBC = new BookingDependencyEntity(
                "dep-bc", tripA, "b-a2", "b-a3", "transit-connection", 60, "hard", null
        );
        dependencyRepository.saveAllAndFlush(List.of(depAB, depBC));

        // Attempt C -> A (creates indirect cycle A -> B -> C -> A)
        CreateDependencyRequest cycleRequest = new CreateDependencyRequest(
                "dep-ca",
                "b-a3",
                "b-a1",
                "transit-connection",
                60,
                "hard",
                null
        );

        mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cycleRequest)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code", is("CONFLICT")))
                .andExpect(jsonPath("$.detail", containsString("Dependency cycle detected involving bookings")));
    }

    @Test
    @DisplayName("GET /api/v1/trips/{tripId}/dependencies returns dependencies for trip")
    void getDependenciesByTripSuccess() throws Exception {
        BookingDependencyEntity dep = new BookingDependencyEntity(
                "dep-list-1", tripA, "b-a1", "b-a2", "arrival-to-lodging", 60, "hard", null
        );
        dependencyRepository.saveAndFlush(dep);

        mockMvc.perform(get("/api/v1/trips/{tripId}/dependencies", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is("dep-list-1")));
    }

    @Test
    @DisplayName("DELETE /api/v1/trips/{tripId}/dependencies/{dependencyId} deletes dependency and returns 204 No Content")
    void deleteDependencySuccess() throws Exception {
        BookingDependencyEntity dep = new BookingDependencyEntity(
                "dep-del-1", tripA, "b-a1", "b-a2", "arrival-to-lodging", 60, "hard", null
        );
        dependencyRepository.saveAndFlush(dep);

        mockMvc.perform(delete("/api/v1/trips/{tripId}/dependencies/{dependencyId}", "trip-a", "dep-del-1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/trips/{tripId}/dependencies", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("Cross-trip delete rejection: DELETE /api/v1/trips/{tripId}/dependencies/{dependencyId} returns 404 when dependency belongs to another trip")
    void deleteDependencyCrossTripRejection() throws Exception {
        BookingDependencyEntity depA = new BookingDependencyEntity(
                "dep-in-trip-a", tripA, "b-a1", "b-a2", "arrival-to-lodging", 60, "hard", null
        );
        dependencyRepository.saveAndFlush(depA);

        // Attempt delete using Trip B's URL
        mockMvc.perform(delete("/api/v1/trips/{tripId}/dependencies/{dependencyId}", "trip-b", "dep-in-trip-a"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is("RESOURCE_NOT_FOUND")));

        // Verify dependency still exists in Trip A
        mockMvc.perform(get("/api/v1/trips/{tripId}/dependencies", "trip-a"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    @DisplayName("Concurrent dependency creation on the same trip serializes via pessimistic lock and prevents cycle race")
    void concurrentDependencyCreationPreventsCycleRace() throws Exception {
        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);

        CreateDependencyRequest req1 = new CreateDependencyRequest(
                "dep-race-1",
                "b-a1",
                "b-a2",
                "transit-connection",
                60,
                "hard",
                "A1 to A2"
        );
        CreateDependencyRequest req2 = new CreateDependencyRequest(
                "dep-race-2",
                "b-a2",
                "b-a1",
                "transit-connection",
                60,
                "hard",
                "A2 to A1"
        );

        Callable<Integer> task1 = () -> {
            readyLatch.countDown();
            readyLatch.await(5, TimeUnit.SECONDS);
            startLatch.await(5, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req1)))
                    .andReturn().getResponse().getStatus();
        };

        Callable<Integer> task2 = () -> {
            readyLatch.countDown();
            readyLatch.await(5, TimeUnit.SECONDS);
            startLatch.await(5, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req2)))
                    .andReturn().getResponse().getStatus();
        };

        Future<Integer> future1 = executor.submit(task1);
        Future<Integer> future2 = executor.submit(task2);

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();

        int status1 = future1.get(10, TimeUnit.SECONDS);
        int status2 = future2.get(10, TimeUnit.SECONDS);
        executor.shutdown();

        // Exactly one request must succeed (201 Created) and the competing reciprocal request
        // must be blocked and subsequently rejected with 409 Conflict upon cycle validation
        assertThat(List.of(status1, status2)).containsExactlyInAnyOrder(201, 409);

        // Verify that database holds exactly one dependency and no cyclic edges exist
        List<BookingDependencyEntity> deps = dependencyRepository.findByTripId("trip-a");
        assertThat(deps).hasSize(1);
    }

    @Test
    @DisplayName("Concurrent dependency creation on different trips execute independently without blocking each other")
    void concurrentDependencyCreationOnDifferentTripsSucceed() throws Exception {
        BookingEntity bB2 = new BookingEntity("b-b2", tripB, "hotel", "Goa Beach Resort", "GOI", null, null, new BigDecimal("8000.00"), "INR", "confirmed");
        bookingRepository.saveAndFlush(bB2);

        int threads = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch readyLatch = new CountDownLatch(threads);
        CountDownLatch startLatch = new CountDownLatch(1);

        CreateDependencyRequest reqA = new CreateDependencyRequest(
                "dep-race-a", "b-a1", "b-a2", "transit-connection", 60, "hard", "Trip A dep"
        );
        CreateDependencyRequest reqB = new CreateDependencyRequest(
                "dep-race-b", "b-b1", "b-b2", "transit-connection", 60, "hard", "Trip B dep"
        );

        Callable<Integer> taskA = () -> {
            readyLatch.countDown();
            readyLatch.await(5, TimeUnit.SECONDS);
            startLatch.await(5, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-a")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reqA)))
                    .andReturn().getResponse().getStatus();
        };

        Callable<Integer> taskB = () -> {
            readyLatch.countDown();
            readyLatch.await(5, TimeUnit.SECONDS);
            startLatch.await(5, TimeUnit.SECONDS);
            return mockMvc.perform(post("/api/v1/trips/{tripId}/dependencies", "trip-b")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reqB)))
                    .andReturn().getResponse().getStatus();
        };

        Future<Integer> futureA = executor.submit(taskA);
        Future<Integer> futureB = executor.submit(taskB);

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown();

        int statusA = futureA.get(10, TimeUnit.SECONDS);
        int statusB = futureB.get(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(statusA).isEqualTo(201);
        assertThat(statusB).isEqualTo(201);
        assertThat(dependencyRepository.findByTripId("trip-a")).hasSize(1);
        assertThat(dependencyRepository.findByTripId("trip-b")).hasSize(1);
    }
}
