package tech.altravel.booking.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<BookingEntity, String> {

    List<BookingEntity> findByTripId(String tripId);

    List<BookingEntity> findByTripIdOrderByStartTimeAsc(String tripId);
}
