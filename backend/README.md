# ALTravel Backend — REST API & Persistence Layer

Java 21, Spring Boot 3.3.5, Spring Data JPA, Flyway, and PostgreSQL 16 backend for **ALTravel** (Travel Disruption Recovery and Traveler Protection).

## Technology Stack

- **Runtime:** Java 21 (LTS)
- **Framework:** Spring Boot 3.3.5 (Spring Web, Spring Data JPA, Jakarta Bean Validation, Spring Boot Actuator)
- **Database:** PostgreSQL 16
- **Schema Migrations:** Flyway (with `flyway-database-postgresql`)
- **Validation:** Hibernate Validator 8 / Jakarta Bean Validation
- **Testing:** JUnit 5, AssertJ, Spring Boot Test, MockMvc, and Testcontainers PostgreSQL 16
- **Build Tool:** Apache Maven Wrapper (`./mvnw`)

---

## 1. Quick Start with PostgreSQL

### Option A: Local Docker Compose (Recommended)

From the project root:

```bash
# 1. Review environment configuration
cp .env.example .env

# 2. Start PostgreSQL container in background
docker compose up -d

# 3. Verify health status
docker compose ps
```

The database container runs on `localhost:5432` with database `altravel`, user `altravel`, and password `altravel_dev_password` (or values defined in `.env`).

### Option B: Existing PostgreSQL Instance

If you already have PostgreSQL 16 running locally, create the database:

```sql
CREATE DATABASE altravel;
CREATE USER altravel WITH ENCRYPTED PASSWORD 'altravel_dev_password';
GRANT ALL PRIVILEGES ON DATABASE altravel TO altravel;
```

---

## 2. Configuration & Environment Variables

The backend application is configured via `src/main/resources/application.yml` and accepts the following environment variables:

| Variable | Default Value | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/altravel` | JDBC connection string |
| `SPRING_DATASOURCE_USERNAME` | `altravel` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | `altravel_dev_password` | Database password |
| `SERVER_PORT` | `8080` | HTTP server port |

---

## 3. Database Schema & Flyway Migrations

Flyway serves as the single source of truth for the relational schema. Hibernate operates in `validate` mode (`spring.jpa.hibernate.ddl-auto=validate`) to ensure entity mappings strictly conform to the migrated database without altering tables.

### Applied Migrations

1. `V1__initial_schema.sql`: Durable schema foundation:
   - `trips`: Itinerary records with start/end dates and check constraints (`end_date >= start_date`).
   - `bookings`: Transport, hotel, and activity records with monetary amounts (`NUMERIC(12,2)`), non-negative cost constraints, and nullable optional timing.
   - `booking_dependencies`: Directed dependency graph links between bookings with composite foreign keys `(upstream_booking_id, trip_id)` and `(downstream_booking_id, trip_id)` referencing `bookings(id, trip_id)` to enforce trip ownership at the database engine level.
2. `V2__unique_dependency_pair.sql`:
   - Adds unique constraint `uq_dep_pair UNIQUE (trip_id, upstream_booking_id, downstream_booking_id)` to guarantee duplicate dependency edges are rejected at the database level.

---

## 4. REST API Documentation

All REST endpoints use the `/api/v1` prefix.

### 4.1 Trips API

#### `POST /api/v1/trips`
Creates a new trip. If `id` is omitted, an ID is generated automatically.

**Request:**
```json
{
  "id": "trip-goa-2026",
  "name": "Goa Vacation",
  "origin": "Hyderabad (HYD)",
  "destination": "Goa (GOI)",
  "startDate": "2026-11-12",
  "endDate": "2026-11-16",
  "isSample": false,
  "description": "Family beach vacation."
}
```

**Response (201 Created):**
```json
{
  "id": "trip-goa-2026",
  "name": "Goa Vacation",
  "origin": "Hyderabad (HYD)",
  "destination": "Goa (GOI)",
  "startDate": "2026-11-12",
  "endDate": "2026-11-16",
  "isSample": false,
  "description": "Family beach vacation.",
  "createdAt": "2026-10-25T19:00:00Z",
  "updatedAt": "2026-10-25T19:00:00Z"
}
```

#### `GET /api/v1/trips`
Retrieves paginated trips sorted deterministically by `createdAt DESC, id ASC`.

- `page`: Zero-indexed page number (default: `0`, must be `>= 0`).
- `size`: Page size (default: `20`, range: `1` to `100`).

**Response (200 OK):**
```json
{
  "content": [
    {
      "id": "trip-goa-2026",
      "name": "Goa Vacation",
      "origin": "Hyderabad (HYD)",
      "destination": "Goa (GOI)",
      "startDate": "2026-11-12",
      "endDate": "2026-11-16",
      "isSample": false,
      "description": "Family beach vacation.",
      "createdAt": "2026-10-25T19:00:00Z",
      "updatedAt": "2026-10-25T19:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "first": true,
  "last": true
}
```

#### `GET /api/v1/trips/{tripId}`
Retrieves a single trip by ID. Returns `404 Not Found` if nonexistent.

#### `PUT /api/v1/trips/{tripId}`
Updates an existing trip's name, origin, destination, dates, sample status, and description.

#### `DELETE /api/v1/trips/{tripId}`
Deletes a trip and cascades deletion to all associated bookings and dependencies. Returns `204 No Content`.

---

### 4.2 Bookings API

Every booking operation strictly validates that the booking belongs to the specified trip in the URL path. Accessing, updating, or deleting a booking through another trip's URL returns `404 Not Found`.

#### `POST /api/v1/trips/{tripId}/bookings`
Adds a booking to the specified trip.

**Request:**
```json
{
  "id": "book-flight-1",
  "type": "flight",
  "provider": "IndiGo 6E-532",
  "location": "RGIA Hyderabad (HYD) → Dabolim Airport, Goa (GOI)",
  "startTime": "2026-11-12T02:45:00Z",
  "endTime": "2026-11-12T04:10:00Z",
  "cost": 4850.00,
  "currency": "INR",
  "status": "confirmed",
  "cancellationDeadline": "2026-11-12T00:45:00Z",
  "arrivalDeadline": "2026-11-12T01:45:00Z",
  "cancellationPolicyNotes": "Cancellation fee ₹3,000 applies up to 2 hours prior to scheduled departure.",
  "notes": "Terminal 1",
  "confirmationReference": "6E-SIM-8921"
}
```

- **Type constraints:** `flight`, `train`, `hotel`, `activity`.
- **Status constraints:** `confirmed`, `pending`, `delayed`, `cancelled`, `completed`.
- **Transport schedule:** Transport bookings (`flight`, `train`) require `startTime`. Lodging and activities allow optional/unknown `startTime`.
- **Time order:** If both `startTime` and `endTime` are provided, `endTime >= startTime` is enforced.

#### `GET /api/v1/trips/{tripId}/bookings`
Returns all bookings belonging to the trip ordered by `startTime ASC`.

#### `GET /api/v1/trips/{tripId}/bookings/{bookingId}`
Returns a single booking. Rejects cross-trip requests with `404 Not Found`.

#### `PUT /api/v1/trips/{tripId}/bookings/{bookingId}`
Updates an existing booking. Nullable fields passed as `null` clear the existing value. Rejects cross-trip requests with `404 Not Found`.

#### `DELETE /api/v1/trips/{tripId}/bookings/{bookingId}`
Deletes the specified booking. Cascading foreign keys remove any dependencies referencing this booking. Rejects cross-trip requests with `404 Not Found`. Returns `204 No Content`.

---

### 4.3 Booking Dependencies API

Dependencies express directed relationships where an upstream travel booking affects a downstream booking.

#### Semantics and Direction:
- `upstreamBookingId` feeds into `downstreamBookingId`.
- Example: Inbound flight (`upstream`) feeds into hotel check-in (`downstream`) with a required transfer buffer (e.g., 120 minutes).
- Relationship types: `transit-connection`, `arrival-to-activity`, `arrival-to-lodging`.
- Commitment types: `hard` (strict cutoff), `flexible` (standard window).

#### Cycle Detection Rules:
A dependency graph must remain a Directed Acyclic Graph (DAG). Cycles would create impossible temporal requirements (e.g., booking A depends on B, which depends on A).
- A 3-color Depth First Search (DFS) runs before creating a dependency.
- Any direct cycle (`A → B → A`) or indirect cycle (`A → B → C → A`) is rejected with `409 Conflict` and an explicit error message:
  ```json
  {
    "status": 409,
    "title": "Conflict",
    "detail": "Dependency cycle detected involving bookings: b-1 → b-2 → b-1.",
    "code": "CONFLICT"
  }
  ```

#### `POST /api/v1/trips/{tripId}/dependencies`
**Request:**
```json
{
  "id": "dep-flight-hotel",
  "upstreamBookingId": "book-flight-1",
  "downstreamBookingId": "book-hotel-1",
  "relationshipType": "arrival-to-lodging",
  "requiredBufferMinutes": 120,
  "commitmentType": "flexible",
  "description": "Flight arrival feeds into hotel check-in."
}
```

**Validations:**
1. Both upstream and downstream bookings must exist and belong to `tripId`.
2. Self-dependencies (`upstream == downstream`) are rejected with `400 Bad Request`.
3. Duplicate dependencies for the same pair in a trip are rejected with `409 Conflict`.
4. Negative buffer minutes are rejected with `400 Bad Request`.
5. Cycles are rejected with `409 Conflict`.

#### `GET /api/v1/trips/{tripId}/dependencies`
Lists all dependencies defined for the trip.

#### `DELETE /api/v1/trips/{tripId}/dependencies/{dependencyId}`
Deletes a dependency. Rejects cross-trip deletion with `404 Not Found`. Returns `204 No Content`.

---

### 4.4 Demo Data Seeding API

#### `POST /api/v1/demo/seed`
Provides an explicit, repeatable mechanism for loading the simulated Hyderabad → Goa demo trip.

- **Payload:** None (empty `POST`).
- **Initial Invocation:** Creates trip `demo-trip-hyd-goa` with 3 bookings (flight, hotel, scuba activity) and 2 dependencies. Returns `201 Created` with `seeded: true`.
- **Idempotency & Safe Repeat Invocation:** If `demo-trip-hyd-goa` already exists, returns `200 OK` with `seeded: false` and the existing trip. It does **not** create duplicate records and **never** overwrites user edits to demo records.

---

### 4.5 Error Handling & Conventions

All error responses strictly follow the RFC 7807 `ProblemDetail` standard:

```json
{
  "type": "urn:problem-type:validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Trip end date cannot be earlier than start date.",
  "instance": "/api/v1/trips",
  "code": "VALIDATION_ERROR",
  "timestamp": "2026-10-25T19:00:00Z"
}
```

| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `INVALID_ARGUMENT` | Request body validation failure with field-specific errors in `fieldErrors` map |
| `400 Bad Request` | `MALFORMED_JSON` | Malformed JSON syntax or unparseable field formats |
| `400 Bad Request` | `VALIDATION_ERROR` | Domain invariant violation (e.g. invalid dates, self-dependency, missing transport start time) |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Specified trip, booking, or dependency does not exist or does not belong to the trip |
| `409 Conflict` | `CONFLICT` | Resource ID conflict, duplicate dependency edge, or dependency cycle |
| `409 Conflict` | `DATA_INTEGRITY_VIOLATION` | Database constraint violation (sanitized without leaking SQL statements) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected server error (sanitized without leaking internal stack traces) |

---

## 5. Running Tests

The test suite runs integration tests against real PostgreSQL 16 instances using Testcontainers:

```bash
cd backend
./mvnw clean test
```

To run a full Maven build and verification:

```bash
cd backend
./mvnw verify
```

To run against a local PostgreSQL database instead of Testcontainers, configure your environment variables:

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/altravel \
SPRING_DATASOURCE_USERNAME=altravel \
SPRING_DATASOURCE_PASSWORD=altravel_dev_password \
./mvnw test
```

---

## 6. Running the Application

```bash
cd backend
./mvnw spring-boot:run
```

Verify application health via Actuator:

```bash
curl http://localhost:8080/actuator/health
```

Expected response:
```json
{"status":"UP","components":{"db":{"status":"UP","details":{"database":"PostgreSQL"}}}}
```
