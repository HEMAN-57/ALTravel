package tech.altravel.booking.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<BookingEntity, String> {

    List<BookingEntity> findByTripId(String tripId);

    List<BookingEntity> findByTripIdOrderByStartTimeAsc(String tripId);

    Optional<BookingEntity> findByIdAndTripId(String id, String tripId);

    boolean existsByIdAndTripId(String id, String tripId);
}
