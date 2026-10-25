package tech.altravel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import tech.altravel.booking.domain.BookingEntity;
import tech.altravel.booking.domain.BookingRepository;
import tech.altravel.dependency.domain.BookingDependencyEntity;
import tech.altravel.dependency.domain.BookingDependencyRepository;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TripPersistenceIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingDependencyRepository dependencyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    @BeforeEach
    void cleanDatabase() {
        dependencyRepository.deleteAll();
        bookingRepository.deleteAll();
        tripRepository.deleteAll();
    }

    @Test
    @DisplayName("Trip and associated bookings can be persisted and retrieved with exact fields")
    void persistAndRetrieveTripWithBookings() {
        TripEntity trip = new TripEntity(
                "trip-sample-goa-1",
                "Goa Coastal Getaway",
                "Hyderabad (HYD)",
                "Goa (GOI)",
                LocalDate.of(2026, 11, 12),
                LocalDate.of(2026, 11, 16),
                true,
                "Simulated demonstration itinerary."
        );

        BookingEntity flight = new BookingEntity(
                "book-flight-1",
                trip,
                "flight",
                "IndiGo 6E-532",
                "HYD → GOI",
                Instant.parse("2026-11-12T02:45:00Z"),
                Instant.parse("2026-11-12T04:10:00Z"),
                new BigDecimal("4850.00"),
                "INR",
                "confirmed"
        );
        flight.setArrivalDeadline(Instant.parse("2026-11-12T01:45:00Z"));
        flight.setCancellationDeadline(Instant.parse("2026-11-12T00:45:00Z"));
        flight.setConfirmationReference("6E-SIM-8921");

        trip.addBooking(flight);

        tripRepository.saveAndFlush(trip);

        Optional<TripEntity> retrievedOpt = tripRepository.findByIdWithBookings("trip-sample-goa-1");
        assertThat(retrievedOpt).isPresent();
        TripEntity retrieved = retrievedOpt.get();
        assertThat(retrieved.getName()).isEqualTo("Goa Coastal Getaway");
        assertThat(retrieved.isSample()).isTrue();
        assertThat(retrieved.getBookings()).hasSize(1);

        BookingEntity retrievedFlight = retrieved.getBookings().get(0);
        assertThat(retrievedFlight.getId()).isEqualTo("book-flight-1");
        assertThat(retrievedFlight.getProvider()).isEqualTo("IndiGo 6E-532");
        assertThat(retrievedFlight.getCost()).isEqualByComparingTo(new BigDecimal("4850.00"));
        assertThat(retrievedFlight.getCurrency()).isEqualTo("INR");
    }

    @Test
    @DisplayName("Booking can have nullable optional timestamps where permitted by domain")
    void bookingNullableOptionalTimestamps() {
        TripEntity trip = new TripEntity(
                "trip-ladakh-1",
                "Ladakh Mountain Trek",
                "Delhi (DEL)",
                "Leh (IXL)",
                LocalDate.of(2026, 12, 1),
                LocalDate.of(2026, 12, 7),
                false,
                "Trek with hotel reservation without explicit check-in time"
        );
        tripRepository.saveAndFlush(trip);

        BookingEntity hotel = new BookingEntity(
                "book-hotel-1",
                trip,
                "hotel",
                "Grand Dragon Ladakh",
                "Old Road, Leh",
                null, // Optional start time omitted
                null, // Optional end time omitted
                new BigDecimal("18500.00"),
                "INR",
                "confirmed"
        );
        hotel.setCancellationPolicyNotes("100% refund if cancelled 48h prior.");
        // arrivalDeadline and cancellationDeadline are null

        bookingRepository.saveAndFlush(hotel);

        Optional<BookingEntity> retrieved = bookingRepository.findById("book-hotel-1");
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getStartTime()).isNull();
        assertThat(retrieved.get().getEndTime()).isNull();
        assertThat(retrieved.get().getArrivalDeadline()).isNull();
        assertThat(retrieved.get().getCancellationDeadline()).isNull();
        assertThat(retrieved.get().getProvider()).isEqualTo("Grand Dragon Ladakh");
    }

    @Test
    @DisplayName("Database rejects negative cost constraint")
    void negativeCostRejectedByDatabaseConstraint() {
        TripEntity trip = new TripEntity(
                "trip-err-1",
                "Error Trip",
                "A",
                "B",
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 5),
                false,
                null
        );
        tripRepository.saveAndFlush(trip);

        // Raw SQL insert bypassing JPA validation to test PostgreSQL chk_booking_cost constraint directly
        assertThatThrownBy(() -> {
            jdbcTemplate.update(
                    "INSERT INTO bookings (id, trip_id, type, provider, location, cost, currency, status) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    "b-neg-1", trip.getId(), "hotel", "Bad Resort", "Goa", -50.00, "INR", "confirmed"
            );
        }).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("chk_booking_cost");
    }

    @Test
    @DisplayName("Database rejects invalid trip date range (end_date < start_date)")
    void invalidDateRangeRejectedByConstraint() {
        // Raw SQL insert testing chk_trip_dates constraint directly
        assertThatThrownBy(() -> {
            jdbcTemplate.update(
                    "INSERT INTO trips (id, name, origin, destination, start_date, end_date, is_sample) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "trip-invalid-dates", "Bad Dates Trip", "DEL", "BOM",
                    LocalDate.of(2026, 6, 10),
                    LocalDate.of(2026, 6, 5), // Invalid: end_date precedes start_date
                    false
            );
        }).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("chk_trip_dates");
    }

    @Test
    @DisplayName("Deleting a trip cascades and deletes bookings and dependencies without orphans")
    void deletingTripCascadesToBookingsAndDependencies() {
        TripEntity trip = new TripEntity(
                "trip-cascade-test",
                "Cascade Trip",
                "HYD",
                "GOI",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 5),
                false,
                "Testing cascading deletion"
        );
        tripRepository.saveAndFlush(trip);

        BookingEntity b1 = new BookingEntity(
                "b-cas-1", trip, "flight", "Airline A", "HYD -> GOI",
                Instant.parse("2026-07-01T08:00:00Z"), null, new BigDecimal("3000.00"), "INR", "confirmed"
        );
        BookingEntity b2 = new BookingEntity(
                "b-cas-2", trip, "hotel", "Resort B", "Goa",
                null, null, new BigDecimal("6000.00"), "INR", "confirmed"
        );
        bookingRepository.saveAllAndFlush(List.of(b1, b2));

        BookingDependencyEntity dep = new BookingDependencyEntity(
                "dep-cas-1", trip, "b-cas-1", "b-cas-2", "arrival-to-lodging", 120, "flexible", "Transit buffer"
        );
        dependencyRepository.saveAndFlush(dep);

        // Verify entities exist
        assertThat(tripRepository.existsById("trip-cascade-test")).isTrue();
        assertThat(bookingRepository.existsById("b-cas-1")).isTrue();
        assertThat(bookingRepository.existsById("b-cas-2")).isTrue();
        assertThat(dependencyRepository.existsById("dep-cas-1")).isTrue();

        // Detach managed entities so Hibernate does not hold stale references during database cascade
        entityManager.clear();

        // Delete parent trip
        tripRepository.deleteById("trip-cascade-test");
        tripRepository.flush();
        entityManager.clear();

        // Verify cascading deletion in PostgreSQL
        assertThat(tripRepository.existsById("trip-cascade-test")).isFalse();
        assertThat(bookingRepository.existsById("b-cas-1")).isFalse();
        assertThat(bookingRepository.existsById("b-cas-2")).isFalse();
        assertThat(dependencyRepository.existsById("dep-cas-1")).isFalse();
    }
}
