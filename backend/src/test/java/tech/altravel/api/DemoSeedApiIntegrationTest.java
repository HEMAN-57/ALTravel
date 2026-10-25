package tech.altravel.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tech.altravel.PostgresIntegrationTestBase;
import tech.altravel.booking.domain.BookingRepository;
import tech.altravel.demo.service.DemoSeedService;
import tech.altravel.dependency.domain.BookingDependencyRepository;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
class DemoSeedApiIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

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
    @DisplayName("POST /api/v1/demo/seed seeds demo trip with bookings and dependencies")
    void seedDemoTripSuccess() throws Exception {
        mockMvc.perform(post("/api/v1/demo/seed"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seeded", is(true)))
                .andExpect(jsonPath("$.message", containsString("successfully seeded")))
                .andExpect(jsonPath("$.trip.id", is(DemoSeedService.DEMO_TRIP_ID)))
                .andExpect(jsonPath("$.trip.isSample", is(true)));

        assertThat(tripRepository.existsById(DemoSeedService.DEMO_TRIP_ID)).isTrue();
        assertThat(bookingRepository.findByTripId(DemoSeedService.DEMO_TRIP_ID)).hasSize(3);
        assertThat(dependencyRepository.findByTripId(DemoSeedService.DEMO_TRIP_ID)).hasSize(2);
    }

    @Test
    @DisplayName("POST /api/v1/demo/seed is idempotent: repeat invocation does not duplicate or overwrite")
    void seedDemoTripIdempotent() throws Exception {
        // Initial seed
        mockMvc.perform(post("/api/v1/demo/seed"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seeded", is(true)));

        // User edits trip name
        TripEntity trip = tripRepository.findById(DemoSeedService.DEMO_TRIP_ID).orElseThrow();
        trip.setName("Custom User Edited Demo Trip Name");
        tripRepository.saveAndFlush(trip);

        // Repeat invocation
        mockMvc.perform(post("/api/v1/demo/seed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seeded", is(false)))
                .andExpect(jsonPath("$.message", containsString("already exists; skipping re-seed")))
                .andExpect(jsonPath("$.trip.name", is("Custom User Edited Demo Trip Name")));

        // Verify count didn't increase
        assertThat(tripRepository.count()).isEqualTo(1);
        assertThat(bookingRepository.count()).isEqualTo(3);
        assertThat(dependencyRepository.count()).isEqualTo(2);

        // Verify user edit was preserved
        TripEntity afterSeed = tripRepository.findById(DemoSeedService.DEMO_TRIP_ID).orElseThrow();
        assertThat(afterSeed.getName()).isEqualTo("Custom User Edited Demo Trip Name");
    }
}
