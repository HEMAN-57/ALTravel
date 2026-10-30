-- V4__tripsync_group_ledger_and_entities.sql
-- TripSync Group Ledger, Travelers, Budgets, and Financial Recalculation Schema

-- Group budget ceiling on trips
ALTER TABLE trips
    ADD COLUMN total_budget NUMERIC(12, 2) DEFAULT 0.00;

-- Booking participant extensions
ALTER TABLE bookings
    ADD COLUMN paid_by_member_id VARCHAR(64),
    ADD COLUMN cost_type VARCHAR(32) DEFAULT 'fixed_shared';

CREATE TABLE booking_participants (
    booking_id VARCHAR(64) NOT NULL,
    member_id VARCHAR(64) NOT NULL,
    PRIMARY KEY (booking_id, member_id),
    CONSTRAINT fk_booking_part_booking FOREIGN KEY (booking_id) 
        REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE INDEX idx_booking_participants_booking ON booking_participants(booking_id);

CREATE TABLE trip_members (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64), -- Nullable for guest/unregistered travellers
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    personal_budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    activity_interests TEXT,
    cost_sensitivity VARCHAR(32) NOT NULL DEFAULT 'balanced',
    preferred_pace VARCHAR(32) NOT NULL DEFAULT 'moderate',
    travel_priority VARCHAR(32) NOT NULL DEFAULT 'minimize-cost',
    willingness_to_pay_speed NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_members_trip FOREIGN KEY (trip_id) 
        REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_members_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_trip_member_id_trip UNIQUE (id, trip_id),
    CONSTRAINT chk_member_role CHECK (role IN ('organizer', 'member', 'admin')),
    CONSTRAINT chk_member_status CHECK (status IN ('active', 'departed', 'invited')),
    CONSTRAINT chk_member_budget CHECK (personal_budget >= 0.00)
);

CREATE INDEX idx_trip_members_trip ON trip_members(trip_id);

CREATE TABLE expenses (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    category VARCHAR(64) NOT NULL DEFAULT 'other',
    paid_by_member_id VARCHAR(64) NOT NULL,
    split_type VARCHAR(32) NOT NULL DEFAULT 'equal',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_expenses_trip FOREIGN KEY (trip_id) 
        REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT chk_expense_amount CHECK (amount >= 0.00),
    CONSTRAINT chk_expense_split_type CHECK (split_type IN ('equal', 'percentage', 'participation', 'custom'))
);

CREATE INDEX idx_expenses_trip ON expenses(trip_id);

CREATE TABLE expense_participants (
    id VARCHAR(64) PRIMARY KEY,
    expense_id VARCHAR(64) NOT NULL,
    member_id VARCHAR(64) NOT NULL,
    share_amount NUMERIC(12, 2),
    share_percentage NUMERIC(5, 2),
    CONSTRAINT fk_exp_part_expense FOREIGN KEY (expense_id) 
        REFERENCES expenses(id) ON DELETE CASCADE
);

CREATE INDEX idx_expense_participants_expense ON expense_participants(expense_id);

CREATE TABLE settlements (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL,
    payer_member_id VARCHAR(64) NOT NULL,
    payee_member_id VARCHAR(64) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    settled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference VARCHAR(128),
    CONSTRAINT fk_settlements_trip FOREIGN KEY (trip_id) 
        REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT chk_settlement_amount CHECK (amount > 0.00)
);

CREATE INDEX idx_settlements_trip ON settlements(trip_id);

CREATE TABLE trip_alerts (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alerts_trip FOREIGN KEY (trip_id) 
        REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT chk_alert_severity CHECK (severity IN ('critical', 'warning', 'info'))
);

CREATE INDEX idx_trip_alerts_trip ON trip_alerts(trip_id);
