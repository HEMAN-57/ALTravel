-- V1__initial_schema.sql
-- ALTravel Relational Schema Foundation for PostgreSQL 16+

CREATE TABLE trips (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    origin VARCHAR(128) NOT NULL,
    destination VARCHAR(128) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_trip_dates CHECK (end_date >= start_date)
);

CREATE TABLE bookings (
    id VARCHAR(64) NOT NULL,
    trip_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
    cancellation_deadline TIMESTAMPTZ,
    arrival_deadline TIMESTAMPTZ,
    cancellation_policy_notes TEXT,
    notes TEXT,
    confirmation_reference VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uq_bookings_id_trip UNIQUE (id, trip_id),
    CONSTRAINT fk_bookings_trip FOREIGN KEY (trip_id) 
        REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT chk_booking_type CHECK (type IN ('flight', 'train', 'hotel', 'activity')),
    CONSTRAINT chk_booking_status CHECK (status IN ('confirmed', 'pending', 'delayed', 'cancelled', 'completed')),
    CONSTRAINT chk_booking_cost CHECK (cost >= 0),
    CONSTRAINT chk_booking_end_after_start CHECK (
        end_time IS NULL OR start_time IS NULL OR end_time >= start_time
    )
);

CREATE INDEX idx_bookings_trip ON bookings(trip_id);

CREATE TABLE booking_dependencies (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL,
    upstream_booking_id VARCHAR(64) NOT NULL,
    downstream_booking_id VARCHAR(64) NOT NULL,
    relationship_type VARCHAR(32) NOT NULL,
    required_buffer_minutes INTEGER NOT NULL DEFAULT 0,
    commitment_type VARCHAR(16) NOT NULL DEFAULT 'hard',
    description TEXT,
    CONSTRAINT fk_dep_trip FOREIGN KEY (trip_id) 
        REFERENCES trips(id) ON DELETE CASCADE,
    -- Composite foreign keys ensuring dependencies never reference bookings across different trips
    CONSTRAINT fk_dep_upstream FOREIGN KEY (upstream_booking_id, trip_id) 
        REFERENCES bookings(id, trip_id) ON DELETE CASCADE,
    CONSTRAINT fk_dep_downstream FOREIGN KEY (downstream_booking_id, trip_id) 
        REFERENCES bookings(id, trip_id) ON DELETE CASCADE,
    CONSTRAINT chk_dep_no_self CHECK (upstream_booking_id <> downstream_booking_id),
    CONSTRAINT chk_dep_buffer CHECK (required_buffer_minutes >= 0),
    CONSTRAINT chk_dep_rel_type CHECK (relationship_type IN ('transit-connection', 'arrival-to-activity', 'arrival-to-lodging')),
    CONSTRAINT chk_dep_commit_type CHECK (commitment_type IN ('hard', 'flexible'))
);

CREATE INDEX idx_deps_trip ON booking_dependencies(trip_id);
