package tech.altravel.group.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "trip_members")
public class TripMemberEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @NotBlank
    @Size(max = 64)
    private String id;

    @Column(name = "trip_id", length = 64, nullable = false)
    @NotBlank
    private String tripId;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(name = "name", length = 255, nullable = false)
    @NotBlank
    private String name;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "role", length = 32, nullable = false)
    private String role = "member";

    @Column(name = "status", length = 32, nullable = false)
    private String status = "active";

    @Column(name = "personal_budget", precision = 12, scale = 2, nullable = false)
    @NotNull
    private BigDecimal personalBudget = BigDecimal.ZERO;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency = "INR";

    @Column(name = "activity_interests", columnDefinition = "TEXT")
    private String activityInterests;

    @Column(name = "cost_sensitivity", length = 32, nullable = false)
    private String costSensitivity = "balanced";

    @Column(name = "preferred_pace", length = 32, nullable = false)
    private String preferredPace = "moderate";

    @Column(name = "travel_priority", length = 32, nullable = false)
    private String travelPriority = "minimize-cost";

    @Column(name = "willingness_to_pay_speed", precision = 3, scale = 2, nullable = false)
    private BigDecimal willingnessToPaySpeed = BigDecimal.valueOf(0.50);

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TripMemberEntity() {
        // Required by JPA
    }

    public TripMemberEntity(String id, String tripId, String userId, String name, String email,
                            String role, String status, BigDecimal personalBudget, String currency,
                            String activityInterests, String costSensitivity, String preferredPace,
                            String travelPriority, BigDecimal willingnessToPaySpeed) {
        this.id = id;
        this.tripId = tripId;
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.role = role != null ? role : "member";
        this.status = status != null ? status : "active";
        this.personalBudget = personalBudget != null ? personalBudget : BigDecimal.ZERO;
        this.currency = currency != null ? currency : "INR";
        this.activityInterests = activityInterests;
        this.costSensitivity = costSensitivity != null ? costSensitivity : "balanced";
        this.preferredPace = preferredPace != null ? preferredPace : "moderate";
        this.travelPriority = travelPriority != null ? travelPriority : "minimize-cost";
        this.willingnessToPaySpeed = willingnessToPaySpeed != null ? willingnessToPaySpeed : BigDecimal.valueOf(0.50);
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public String getTripId() {
        return tripId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getPersonalBudget() {
        return personalBudget;
    }

    public void setPersonalBudget(BigDecimal personalBudget) {
        this.personalBudget = personalBudget;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getActivityInterests() {
        return activityInterests;
    }

    public void setActivityInterests(String activityInterests) {
        this.activityInterests = activityInterests;
    }

    public String getCostSensitivity() {
        return costSensitivity;
    }

    public void setCostSensitivity(String costSensitivity) {
        this.costSensitivity = costSensitivity;
    }

    public String getPreferredPace() {
        return preferredPace;
    }

    public void setPreferredPace(String preferredPace) {
        this.preferredPace = preferredPace;
    }

    public String getTravelPriority() {
        return travelPriority;
    }

    public void setTravelPriority(String travelPriority) {
        this.travelPriority = travelPriority;
    }

    public BigDecimal getWillingnessToPaySpeed() {
        return willingnessToPaySpeed;
    }

    public void setWillingnessToPaySpeed(BigDecimal willingnessToPaySpeed) {
        this.willingnessToPaySpeed = willingnessToPaySpeed;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TripMemberEntity that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
