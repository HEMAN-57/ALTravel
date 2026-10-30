-- V3__user_accounts_and_auth.sql
-- TripSync User Accounts, Profiles, and Trip Ownership

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'ROLE_USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_email_format CHECK (email LIKE '%@%')
);

CREATE INDEX idx_users_email ON users(email);

CREATE TABLE user_profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE,
    preferred_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    avatar_url VARCHAR(512),
    cost_sensitivity VARCHAR(32) NOT NULL DEFAULT 'balanced',
    preferred_pace VARCHAR(32) NOT NULL DEFAULT 'moderate',
    primary_priority VARCHAR(32) NOT NULL DEFAULT 'preserve-activity',
    willingness_to_pay_speed NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_profile_cost_sens CHECK (cost_sensitivity IN ('budget', 'balanced', 'splurge')),
    CONSTRAINT chk_profile_pace CHECK (preferred_pace IN ('relaxed', 'moderate', 'fast')),
    CONSTRAINT chk_profile_speed_wtp CHECK (willingness_to_pay_speed >= 0.0 AND willingness_to_pay_speed <= 1.0)
);

CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);

-- Associate trips with an owner user account (nullable for sample/guest trips)
ALTER TABLE trips
    ADD COLUMN user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_trips_user ON trips(user_id);
