package tech.altravel.dependency.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingDependencyRepository extends JpaRepository<BookingDependencyEntity, String> {

    List<BookingDependencyEntity> findByTripId(String tripId);

    List<BookingDependencyEntity> findByUpstreamBookingId(String upstreamBookingId);

    List<BookingDependencyEntity> findByDownstreamBookingId(String downstreamBookingId);
}
