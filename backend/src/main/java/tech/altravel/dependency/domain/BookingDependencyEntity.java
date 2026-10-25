package tech.altravel.dependency.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import tech.altravel.trip.domain.TripEntity;

import java.util.Objects;

/**
 * Explicit dependency link expressing that an upstream travel booking affects a downstream booking.
 */
@Entity
@Table(name = "booking_dependencies")
public class BookingDependencyEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @NotBlank
    @Size(max = 64)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @NotNull
    private TripEntity trip;

    @Column(name = "upstream_booking_id", length = 64, nullable = false)
    @NotBlank
    @Size(max = 64)
    private String upstreamBookingId;

    @Column(name = "downstream_booking_id", length = 64, nullable = false)
    @NotBlank
    @Size(max = 64)
    private String downstreamBookingId;

    @Column(name = "relationship_type", length = 32, nullable = false)
    @NotBlank
    @Size(max = 32)
    private String relationshipType;

    @Column(name = "required_buffer_minutes", nullable = false)
    @NotNull
    @Min(value = 0, message = "Buffer minutes must be non-negative")
    private Integer requiredBufferMinutes = 0;

    @Column(name = "commitment_type", length = 16, nullable = false)
    @NotBlank
    @Size(max = 16)
    private String commitmentType = "hard";

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    protected BookingDependencyEntity() {
        // Required by JPA
    }

    public BookingDependencyEntity(String id, TripEntity trip, String upstreamBookingId,
                                   String downstreamBookingId, String relationshipType,
                                   Integer requiredBufferMinutes, String commitmentType,
                                   String description) {
        this.id = id;
        this.trip = trip;
        this.upstreamBookingId = upstreamBookingId;
        this.downstreamBookingId = downstreamBookingId;
        this.relationshipType = relationshipType;
        this.requiredBufferMinutes = requiredBufferMinutes != null ? requiredBufferMinutes : 0;
        this.commitmentType = commitmentType != null ? commitmentType : "hard";
        this.description = description;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public TripEntity getTrip() {
        return trip;
    }

    public void setTrip(TripEntity trip) {
        this.trip = trip;
    }

    public String getUpstreamBookingId() {
        return upstreamBookingId;
    }

    public void setUpstreamBookingId(String upstreamBookingId) {
        this.upstreamBookingId = upstreamBookingId;
    }

    public String getDownstreamBookingId() {
        return downstreamBookingId;
    }

    public void setDownstreamBookingId(String downstreamBookingId) {
        this.downstreamBookingId = downstreamBookingId;
    }

    public String getRelationshipType() {
        return relationshipType;
    }

    public void setRelationshipType(String relationshipType) {
        this.relationshipType = relationshipType;
    }

    public Integer getRequiredBufferMinutes() {
        return requiredBufferMinutes;
    }

    public void setRequiredBufferMinutes(Integer requiredBufferMinutes) {
        this.requiredBufferMinutes = requiredBufferMinutes;
    }

    public String getCommitmentType() {
        return commitmentType;
    }

    public void setCommitmentType(String commitmentType) {
        this.commitmentType = commitmentType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BookingDependencyEntity that = (BookingDependencyEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "BookingDependencyEntity{" +
                "id='" + id + '\'' +
                ", upstreamBookingId='" + upstreamBookingId + '\'' +
                ", downstreamBookingId='" + downstreamBookingId + '\'' +
                ", relationshipType='" + relationshipType + '\'' +
                ", requiredBufferMinutes=" + requiredBufferMinutes +
                ", commitmentType='" + commitmentType + '\'' +
                '}';
    }
}
