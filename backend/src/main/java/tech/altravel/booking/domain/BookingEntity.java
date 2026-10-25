package tech.altravel.booking.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import tech.altravel.trip.domain.TripEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

/**
 * Booking entity representing a transport, lodging, or activity segment within a trip.
 */
@Entity
@Table(name = "bookings")
public class BookingEntity {

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

    @Column(name = "type", length = 32, nullable = false)
    @NotBlank
    @Size(max = 32)
    private String type;

    @Column(name = "provider", length = 255, nullable = false)
    @NotBlank
    @Size(max = 255)
    private String provider;

    @Column(name = "location", length = 255, nullable = false)
    @NotBlank
    @Size(max = 255)
    private String location;

    @Column(name = "start_time")
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "cost", nullable = false, precision = 12, scale = 2)
    @NotNull
    @DecimalMin(value = "0.00", message = "Cost must be non-negative")
    private BigDecimal cost = BigDecimal.ZERO;

    @Column(name = "currency", length = 3, nullable = false)
    @NotBlank
    @Size(min = 3, max = 3)
    private String currency = "INR";

    @Column(name = "status", length = 32, nullable = false)
    @NotBlank
    @Size(max = 32)
    private String status = "confirmed";

    @Column(name = "cancellation_deadline")
    private Instant cancellationDeadline;

    @Column(name = "arrival_deadline")
    private Instant arrivalDeadline;

    @Column(name = "cancellation_policy_notes", columnDefinition = "TEXT")
    private String cancellationPolicyNotes;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "confirmation_reference", length = 64)
    @Size(max = 64)
    private String confirmationReference;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected BookingEntity() {
        // Required by JPA
    }

    public BookingEntity(String id, TripEntity trip, String type, String provider, String location,
                         Instant startTime, Instant endTime, BigDecimal cost, String currency, String status) {
        this.id = id;
        this.trip = trip;
        this.type = type;
        this.provider = provider;
        this.location = location;
        this.startTime = startTime;
        this.endTime = endTime;
        this.cost = cost != null ? cost : BigDecimal.ZERO;
        this.currency = currency != null ? currency.toUpperCase() : "INR";
        this.status = status != null ? status : "confirmed";
    }

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public void setStartTime(Instant startTime) {
        this.startTime = startTime;
    }

    public Instant getEndTime() {
        return endTime;
    }

    public void setEndTime(Instant endTime) {
        this.endTime = endTime;
    }

    public BigDecimal getCost() {
        return cost;
    }

    public void setCost(BigDecimal cost) {
        this.cost = cost;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCancellationDeadline() {
        return cancellationDeadline;
    }

    public void setCancellationDeadline(Instant cancellationDeadline) {
        this.cancellationDeadline = cancellationDeadline;
    }

    public Instant getArrivalDeadline() {
        return arrivalDeadline;
    }

    public void setArrivalDeadline(Instant arrivalDeadline) {
        this.arrivalDeadline = arrivalDeadline;
    }

    public String getCancellationPolicyNotes() {
        return cancellationPolicyNotes;
    }

    public void setCancellationPolicyNotes(String cancellationPolicyNotes) {
        this.cancellationPolicyNotes = cancellationPolicyNotes;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getConfirmationReference() {
        return confirmationReference;
    }

    public void setConfirmationReference(String confirmationReference) {
        this.confirmationReference = confirmationReference;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BookingEntity that = (BookingEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "BookingEntity{" +
                "id='" + id + '\'' +
                ", type='" + type + '\'' +
                ", provider='" + provider + '\'' +
                ", location='" + location + '\'' +
                ", startTime=" + startTime +
                ", cost=" + cost +
                ", currency='" + currency + '\'' +
                ", status='" + status + '\'' +
                '}';
    }
}
