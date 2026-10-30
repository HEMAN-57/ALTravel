package tech.altravel.trip.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tech.altravel.booking.domain.BookingEntity;
import tech.altravel.dependency.domain.BookingDependencyEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Trip aggregate root representing an itinerary across dates and destinations.
 */
@Entity
@Table(name = "trips")
public class TripEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @NotBlank
    @Size(max = 64)
    private String id;

    @Column(name = "name", length = 255, nullable = false)
    @NotBlank
    @Size(max = 255)
    private String name;

    @Column(name = "origin", length = 128, nullable = false)
    @NotBlank
    @Size(max = 128)
    private String origin;

    @Column(name = "destination", length = 128, nullable = false)
    @NotBlank
    @Size(max = 128)
    private String destination;

    @Column(name = "start_date", nullable = false)
    @NotNull
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    @NotNull
    private LocalDate endDate;

    @Column(name = "is_sample", nullable = false)
    private boolean isSample = false;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(name = "total_budget")
    private java.math.BigDecimal totalBudget;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "trip", cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    private List<BookingEntity> bookings = new ArrayList<>();

    @OneToMany(mappedBy = "trip", cascade = {CascadeType.PERSIST, CascadeType.MERGE}, fetch = FetchType.LAZY)
    private List<BookingDependencyEntity> dependencies = new ArrayList<>();

    protected TripEntity() {
        // Required by JPA
    }

    public TripEntity(String id, String name, String origin, String destination,
                      LocalDate startDate, LocalDate endDate, boolean isSample, String description) {
        this.id = id;
        this.name = name;
        this.origin = origin;
        this.destination = destination;
        this.startDate = startDate;
        this.endDate = endDate;
        this.isSample = isSample;
        this.description = description;
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Helper methods for collection management
    public void addBooking(BookingEntity booking) {
        if (booking != null) {
            this.bookings.add(booking);
            booking.setTrip(this);
        }
    }

    public void removeBooking(BookingEntity booking) {
        if (booking != null) {
            this.bookings.remove(booking);
            booking.setTrip(null);
        }
    }

    public void addDependency(BookingDependencyEntity dependency) {
        if (dependency != null) {
            this.dependencies.add(dependency);
            dependency.setTrip(this);
        }
    }

    public void removeDependency(BookingDependencyEntity dependency) {
        if (dependency != null) {
            this.dependencies.remove(dependency);
            dependency.setTrip(null);
        }
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getOrigin() {
        return origin;
    }

    public void setOrigin(String origin) {
        this.origin = origin;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public boolean isSample() {
        return isSample;
    }

    public void setSample(boolean sample) {
        isSample = sample;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<BookingEntity> getBookings() {
        return Collections.unmodifiableList(bookings);
    }

    public List<BookingDependencyEntity> getDependencies() {
        return Collections.unmodifiableList(dependencies);
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public java.math.BigDecimal getTotalBudget() {
        return totalBudget;
    }

    public void setTotalBudget(java.math.BigDecimal totalBudget) {
        this.totalBudget = totalBudget;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TripEntity that = (TripEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "TripEntity{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", origin='" + origin + '\'' +
                ", destination='" + destination + '\'' +
                ", startDate=" + startDate +
                ", endDate=" + endDate +
                ", isSample=" + isSample +
                '}';
    }
}
