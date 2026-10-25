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
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingDependencyConstraintIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private TripRepository tripRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BookingDependencyRepository dependencyRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private TripEntity tripA;
    private TripEntity tripB;
    private BookingEntity bookingA1;
    private BookingEntity bookingA2;
    private BookingEntity bookingB1;

    @BeforeEach
    void setupTripsAndBookings() {
        dependencyRepository.deleteAll();
        bookingRepository.deleteAll();
        tripRepository.deleteAll();

        tripA = new TripEntity(
                "trip-a", "Trip Alpha", "DEL", "BOM",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5), false, null
        );
        tripB = new TripEntity(
                "trip-b", "Trip Beta", "BLR", "GOI",
                LocalDate.of(2026, 8, 1), LocalDate.of(2026, 8, 5), false, null
        );
        tripRepository.saveAllAndFlush(List.of(tripA, tripB));

        bookingA1 = new BookingEntity(
                "b-a1", tripA, "flight", "Air India", "DEL -> BOM",
                null, null, new BigDecimal("4000.00"), "INR", "confirmed"
        );
        bookingA2 = new BookingEntity(
                "b-a2", tripA, "hotel", "Taj Mahal Palace", "Mumbai",
                null, null, new BigDecimal("12000.00"), "INR", "confirmed"
        );
        bookingB1 = new BookingEntity(
                "b-b1", tripB, "flight", "Akasa Air", "BLR -> GOI",
                null, null, new BigDecimal("3500.00"), "INR", "confirmed"
        );
        bookingRepository.saveAllAndFlush(List.of(bookingA1, bookingA2, bookingB1));
    }

    @Test
    @DisplayName("Valid intra-trip dependency succeeds")
    void validDependencyPersists() {
        BookingDependencyEntity dep = new BookingDependencyEntity(
                "dep-valid-1", tripA, "b-a1", "b-a2", "arrival-to-lodging", 90, "flexible", "Flight to hotel"
        );
        dependencyRepository.saveAndFlush(dep);

        assertThat(dependencyRepository.existsById("dep-valid-1")).isTrue();
        List<BookingDependencyEntity> list = dependencyRepository.findByTripId("trip-a");
        assertThat(list).hasSize(1);
        assertThat(list.get(0).getRequiredBufferMinutes()).isEqualTo(90);
    }

    @Test
    @DisplayName("Cross-trip dependency is rejected by PostgreSQL composite foreign key constraint")
    void crossTripDependencyRejectedByCompositeForeignKey() {
        // Attempt to create a dependency in Trip A where downstream booking belongs to Trip B
        // The composite foreign key fk_dep_downstream (downstream_booking_id, trip_id) REFERENCES bookings(id, trip_id)
        // must fail because (b-b1, trip-a) does not exist in bookings table!
        assertThatThrownBy(() -> {
            jdbcTemplate.update(
                    "INSERT INTO booking_dependencies (id, trip_id, upstream_booking_id, downstream_booking_id, relationship_type, required_buffer_minutes, commitment_type) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "dep-cross-err", "trip-a", "b-a1", "b-b1", "transit-connection", 60, "hard"
            );
        }).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("fk_dep_downstream");
    }

    @Test
    @DisplayName("Cross-trip dependency with foreign upstream booking is also rejected")
    void crossTripUpstreamBookingRejected() {
        // Attempt to create a dependency in Trip B where upstream booking belongs to Trip A
        assertThatThrownBy(() -> {
            jdbcTemplate.update(
                    "INSERT INTO booking_dependencies (id, trip_id, upstream_booking_id, downstream_booking_id, relationship_type, required_buffer_minutes, commitment_type) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "dep-cross-err-2", "trip-b", "b-a1", "b-b1", "transit-connection", 60, "hard"
            );
        }).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("fk_dep_upstream");
    }

    @Test
    @DisplayName("Self-dependency is rejected by chk_dep_no_self constraint")
    void selfDependencyRejectedByConstraint() {
        assertThatThrownBy(() -> {
            jdbcTemplate.update(
                    "INSERT INTO booking_dependencies (id, trip_id, upstream_booking_id, downstream_booking_id, relationship_type, required_buffer_minutes, commitment_type) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "dep-self-err", "trip-a", "b-a1", "b-a1", "transit-connection", 60, "hard"
            );
        }).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("chk_dep_no_self");
    }

    @Test
    @DisplayName("Negative required buffer minutes is rejected by chk_dep_buffer constraint")
    void negativeBufferRejectedByConstraint() {
        assertThatThrownBy(() -> {
            jdbcTemplate.update(
                    "INSERT INTO booking_dependencies (id, trip_id, upstream_booking_id, downstream_booking_id, relationship_type, required_buffer_minutes, commitment_type) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "dep-neg-buffer", "trip-a", "b-a1", "b-a2", "transit-connection", -30, "hard"
            );
        }).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("chk_dep_buffer");
    }

    @Test
    @DisplayName("Database rejects duplicate dependency pair (uq_dep_pair constraint)")
    void duplicateDependencyPairRejectedByDatabaseConstraint() {
        jdbcTemplate.update(
                "INSERT INTO booking_dependencies (id, trip_id, upstream_booking_id, downstream_booking_id, relationship_type, required_buffer_minutes, commitment_type) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?)",
                "dep-orig-sql", "trip-a", "b-a1", "b-a2", "transit-connection", 30, "hard"
        );

        assertThatThrownBy(() -> {
            jdbcTemplate.update(
                    "INSERT INTO booking_dependencies (id, trip_id, upstream_booking_id, downstream_booking_id, relationship_type, required_buffer_minutes, commitment_type) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "dep-dup-sql", "trip-a", "b-a1", "b-a2", "transit-connection", 60, "flexible"
            );
        }).isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uq_dep_pair");
    }

    @Test
    @DisplayName("Foreign key ON DELETE CASCADE automatically removes dependencies when referenced booking is deleted")
    void foreignKeyCascadeDeletesDependenciesOnBookingDeletion() {
        BookingDependencyEntity dep = new BookingDependencyEntity(
                "dep-cascade-db", tripA, "b-a1", "b-a2", "transit-connection", 60, "hard", "DB cascade test"
        );
        dependencyRepository.saveAndFlush(dep);
        assertThat(dependencyRepository.existsById("dep-cascade-db")).isTrue();

        // Delete booking b-a1 directly
        bookingRepository.deleteById("b-a1");
        bookingRepository.flush();

        // Verify the dependency was cascaded and deleted by PostgreSQL
        assertThat(dependencyRepository.existsById("dep-cascade-db")).isFalse();
        // Verify unrelated booking b-a2 remains intact
        assertThat(bookingRepository.existsById("b-a2")).isTrue();
    }
}
