# ALTravel Backend — Milestone 1: Foundation

Java 21, Spring Boot 3.3, Spring Data JPA, and PostgreSQL 16 persistence foundation for **ALTravel** (Travel Disruption Recovery and Traveler Protection).

## Technology Stack

- **Runtime:** Java 21 (LTS)
- **Framework:** Spring Boot 3.3.5
- **ORM / Persistence:** Spring Data JPA with Hibernate 6 (`ddl-auto: validate`)
- **Database Migrations:** Flyway (with `flyway-database-postgresql`)
- **Database:** PostgreSQL 16
- **Testing:** JUnit 5, AssertJ, Spring Boot Test, and Testcontainers PostgreSQL 16
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

Flyway serves as the single source of truth for the relational schema. Hibernate operates in `validate` mode to ensure entity mappings strictly conform to the migrated database without modifying tables.

### Applied Migrations

- `V1__initial_schema.sql`: Durable schema foundation:
  - `trips`: Itinerary records with start/end dates and check constraints (`end_date >= start_date`).
  - `bookings`: Transport, hotel, and activity records with monetary amounts (`NUMERIC(12,2)`), non-negative constraints, and nullable optional timing.
  - `booking_dependencies`: Directed dependency graph links between bookings with composite foreign keys enforcing that upstream and downstream bookings strictly belong to the same parent trip.

---

## 4. Running Tests

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

To run against a local PostgreSQL database instead of Testcontainers, configure your environment variables and execute:

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/altravel \
SPRING_DATASOURCE_USERNAME=altravel \
SPRING_DATASOURCE_PASSWORD=altravel_dev_password \
./mvnw test
```

---

## 5. Running the Application

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
