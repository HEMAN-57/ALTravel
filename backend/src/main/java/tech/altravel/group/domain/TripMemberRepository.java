package tech.altravel.group.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripMemberRepository extends JpaRepository<TripMemberEntity, String> {

    List<TripMemberEntity> findByTripId(String tripId);

    void deleteByTripId(String tripId);
}
