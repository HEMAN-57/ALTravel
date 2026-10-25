-- V2__unique_dependency_pair.sql
-- Enforce unique dependency pairing per trip as a database-level invariant

ALTER TABLE booking_dependencies
    ADD CONSTRAINT uq_dep_pair UNIQUE (trip_id, upstream_booking_id, downstream_booking_id);
