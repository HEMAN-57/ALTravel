package tech.altravel.trip.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TripRepository extends JpaRepository<TripEntity, String> {

    @Query("SELECT t FROM TripEntity t LEFT JOIN FETCH t.bookings WHERE t.id = :id")
    Optional<TripEntity> findByIdWithBookings(@Param("id") String id);

    @Query("SELECT t FROM TripEntity t LEFT JOIN FETCH t.dependencies WHERE t.id = :id")
    Optional<TripEntity> findByIdWithDependencies(@Param("id") String id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM TripEntity t WHERE t.id = :id")
    Optional<TripEntity> findByIdForUpdate(@Param("id") String id);

    boolean existsByIdAndIsSampleTrue(String id);
}
