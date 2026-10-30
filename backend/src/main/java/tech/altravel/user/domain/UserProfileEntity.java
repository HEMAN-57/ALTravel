package tech.altravel.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "user_profiles")
public class UserProfileEntity {

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @NotBlank
    @Size(max = 64)
    private String id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private UserEntity user;

    @Column(name = "preferred_currency", length = 3, nullable = false)
    private String preferredCurrency = "INR";

    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    @Column(name = "cost_sensitivity", length = 32, nullable = false)
    private String costSensitivity = "balanced";

    @Column(name = "preferred_pace", length = 32, nullable = false)
    private String preferredPace = "moderate";

    @Column(name = "primary_priority", length = 32, nullable = false)
    private String primaryPriority = "preserve-activity";

    @Column(name = "willingness_to_pay_speed", precision = 3, scale = 2, nullable = false)
    private BigDecimal willingnessToPaySpeed = BigDecimal.valueOf(0.50);

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserProfileEntity() {
        // Required by JPA
    }

    public UserProfileEntity(String id, UserEntity user, String preferredCurrency, String avatarUrl,
                             String costSensitivity, String preferredPace, String primaryPriority,
                             BigDecimal willingnessToPaySpeed) {
        this.id = id;
        this.user = user;
        this.preferredCurrency = preferredCurrency != null ? preferredCurrency : "INR";
        this.avatarUrl = avatarUrl;
        this.costSensitivity = costSensitivity != null ? costSensitivity : "balanced";
        this.preferredPace = preferredPace != null ? preferredPace : "moderate";
        this.primaryPriority = primaryPriority != null ? primaryPriority : "preserve-activity";
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

    public UserEntity getUser() {
        return user;
    }

    public void setUser(UserEntity user) {
        this.user = user;
    }

    public String getPreferredCurrency() {
        return preferredCurrency;
    }

    public void setPreferredCurrency(String preferredCurrency) {
        this.preferredCurrency = preferredCurrency;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
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

    public String getPrimaryPriority() {
        return primaryPriority;
    }

    public void setPrimaryPriority(String primaryPriority) {
        this.primaryPriority = primaryPriority;
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
        if (!(o instanceof UserProfileEntity that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
