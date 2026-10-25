# ALTravel — When travel goes wrong, find your next best move.

**ALTravel** is a travel disruption recovery and traveller protection web application. When a flight or train is delayed or cancelled, ALTravel models connected bookings, identifies downstream consequences across connecting transport, hotels, and activities, compares recovery options, and generates a deadline-ordered action plan.

> **Status:** Milestone 1 (Project Foundation) & Milestone 2 (Disruption Propagation Engine) completed. Deterministic, pure TypeScript business logic decoupled from presentation.

---

## 1. Product Vision

Travel bookings do not exist in isolation:
* A 60-minute train delay may leave adequate buffer for a connecting journey, whereas a 100-minute delay consumes the transfer window and causes a missed connection.
* Arriving late in the evening should not automatically forfeit a flexible hotel room or trigger false assumptions about non-refundable cancellation penalties.
* Cancelling an upstream flight directly threatens time-sensitive prepaid activities and subsequent legs that depend on it.

ALTravel provides travellers with clarity, deterministic evidence, and objective consequence analysis when disruptions strike.

---

## 2. Technology Stack

* **UI Framework:** React (v18.3.1) with StrictMode
* **Language:** TypeScript with strict type checking (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noEmit`)
* **Build Tool & Dev Server:** Vite
* **Styling & Design System:** Tailwind CSS with custom HSL tokens, accessible focus rings, and responsive typography
* **Component Architecture:** Inspired by shadcn/ui (composable, headless-ready primitives with `clsx` and `tailwind-merge`)
* **Icons:** Lucide Icons (`lucide-react`)
* **Persistence:** Browser `localStorage` with explicit save verification, corruption fallback, and scoped reset
* **Testing:** Vitest with jsdom environment and `@testing-library/react` (60 passing tests)
* **Linting:** ESLint with typescript-eslint and React Hooks rules

> **Important:** No backend server (Spring Boot, Django, Express), no external database, no authentication, and no paid third-party APIs are used in this milestone.

---

## 3. Project Architecture

The codebase strictly decouples business domain logic from UI presentation and persistence:

```text
altravel/
├── public/                     # Static public assets (SVG favicon, icons)
├── src/
│   ├── app/                    # Application configuration and metadata
│   ├── components/             # Reusable UI and layout building blocks
│   │   ├── layout/             # AppShell, Navbar, Footer
│   │   └── ui/                 # Button, Card, Badge, Input, Select, Modal, Alert
│   ├── features/
│   │   └── trips/              # Trip management UI features
│   │       ├── EmptyState.tsx
│   │       ├── TripCard.tsx
│   │       ├── TripDetailView.tsx
│   │       ├── BookingItem.tsx
│   │       ├── CreateTripModal.tsx
│   │       ├── CreateBookingModal.tsx
│   │       └── RecoveryPlannerPlaceholder.tsx
│   ├── domain/                 # Pure TypeScript domain models and deterministic engines
│   │   ├── trips/              # Trip types, validation, and relationship verification
│   │   ├── bookings/           # Booking types, status/type invariants, and validation
│   │   └── disruptions/        # Disruption propagation engine & explicit dependency model
│   │       ├── dependency.types.ts      # BookingDependency, relationship & commitment types
│   │       ├── dependency.validation.ts # Graph validation, cycle detection (DFS), missing refs
│   │       ├── disruption.types.ts      # DisruptionInput, ImpactStatus, BookingImpact, evidence
│   │       ├── disruption.validation.ts # Strict input validation for delays & cancellations
│   │       └── propagation.engine.ts    # Deterministic consequence propagation engine
│   ├── lib/                    # Storage and utilities
│   │   ├── demo-data.ts        # Synthetic demonstration trip (Hyderabad → Goa) with dependencies
│   │   ├── storage.ts          # Resilient localStorage adapter with explicit save results
│   │   └── utils.ts            # Formatting (currency, date) and class merger
│   ├── test/                   # Vitest unit test suites
│   │   ├── setup.ts            # Global test setup and Storage mock
│   │   ├── domain.test.ts      # Domain validation and invariant tests (19 tests)
│   │   ├── storage.test.ts     # Persistence, corruption & save failure tests (13 tests)
│   │   ├── sample-trip.test.ts # Simulated fixture integrity tests (4 tests)
│   │   ├── modal.test.tsx      # Modal keyboard accessibility & focus trap tests (6 tests)
│   │   ├── app-persistence.test.tsx # UI persistence error handling tests (3 tests)
│   │   └── propagation.test.ts # Disruption engine Scenarios A–F & edge cases (15 tests)
│   ├── App.tsx                 # Root application shell and view controller
│   ├── main.tsx                # React DOM entrypoint
│   └── index.css               # Tailwind directives and accessible theme tokens
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 4. Disruption Propagation Engine (Milestone 2)

The disruption engine (`src/domain/disruptions/propagation.engine.ts`) models how travel delays and cancellations propagate across connected itineraries.

### 4.1 Explicit Dependency Model
Dependencies are **never inferred** merely because bookings belong to the same trip. They must be explicitly declared as a `BookingDependency`:
* `upstreamBookingId`: The preceding booking (e.g., flight, feeder train).
* `downstreamBookingId`: The dependent booking (e.g., connecting train, hotel, activity).
* `relationshipType`:
  - `transit-connection`: Transport leg connecting to onward transport.
  - `arrival-to-activity`: Transport arrival preceding a scheduled tour/activity.
  - `arrival-to-lodging`: Transport arrival feeding into hotel check-in.
* `requiredBufferMinutes`: Minimum transfer/transit buffer required (e.g. 45 min for platform change, 120 min for airport transit).
* `commitmentType`:
  - `hard`: Strict cutoff or non-negotiable departure (e.g. connecting train, dive boat departure).
  - `flexible`: Adaptable window (e.g. standard hotel check-in with 24h reception).

### 4.2 Impact Statuses
The engine produces a deterministic `ImpactStatus` for every booking:
* `affected`: A definite downstream failure. Either the required transfer buffer is violated, an upstream connection was cancelled, or a hard arrival deadline was missed.
* `atRisk`: A potential problem requiring traveller attention where data or policies allow flexibility (e.g., upstream leg cancelled but hotel has flexible reception; or transfer buffer was unspecified).
* `unaffected`: The booking is feasible. Revised arrival satisfies the required transfer buffer, or the booking has no dependency path from the disrupted segment.
* `unknown`: Incomplete or malformed schedule data prevents reaching a deterministic conclusion (e.g., missing departure or arrival timestamps).

### 4.3 Engine Assumptions & Non-Inference Rules
* **No Live Tracking:** The engine operates deterministically on user-provided or synthetic itinerary data; it does not query live flight or train radars.
* **No Invented Policies:** The engine does not invent provider cancellation fees, rebooking charges, or synthetic cutoff deadlines.
* **Hotel Uncertainty Rule:** When transport is delayed or cancelled, the engine **does not** automatically mark a downstream hotel as lost or non-refundable. If check-in is flexible and no guaranteed cutoff is exceeded, the hotel remains `unaffected` or `atRisk`.
* **Cycle Prevention:** All dependency graphs are checked for directed cycles using depth-first search (DFS). Graphs containing self-references or cyclic dependencies are rejected with explicit errors.

---

## 5. Scope Boundaries

### Completed in Milestones 1 & 2:
- Project foundation, application shell, responsive layout, accessible UI primitives.
- Strongly typed domain models for Trips, Bookings, and Dependencies.
- Resilient localStorage persistence with explicit save verification and scoped resets.
- Synthetic demo trip (Hyderabad → Goa) with flight, resort hotel, and scuba diving.
- Deterministic disruption propagation engine supporting delays, cancellations, and DAG traversal.
- 60 passing Vitest unit/integration tests across 6 test suites.

### Explicitly Deferred to Milestone 3+:
- Recovery option generation and comparison.
- Multi-criteria Pareto filtering (trade-offs between time, cost, comfort, and fatigue).
- Deadline-ordered action plan generation.
- Interactive UI for running disruption simulations (currently shown as an architectural preview).
- Live airline/train APIs, calendar sync, user authentication, or backend databases.

---

## 6. Installation & Development Commands

### Install dependencies
```bash
npm install
```

### Start development server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Run unit tests
```bash
npm run test
```

### Run TypeScript type checking
```bash
npm run typecheck
```

### Run ESLint
```bash
npm run lint
```

### Build production bundle
```bash
npm run build
```

---

## 7. Instructions for Evaluating the Disruption Engine Tests

To run the complete test suite including the hand-calculated scenarios:
```bash
npm run test
```
The test suite in `src/test/propagation.test.ts` executes:
* **Scenario A (Connection survives):** Train 1 arriving at 10:00 is delayed 60m (arrives 11:00). Connecting train departs at 12:00 with a 45m required buffer. Leaves 60m available transfer -> `unaffected`.
* **Scenario B (Connection missed):** Train 1 delayed 100m (arrives 11:40). Connecting train departs at 12:00 with a 45m buffer. Leaves 20m available transfer (deficit of 25m) -> `affected`.
* **Scenario C (Cancellation):** Upstream transport is cancelled. Dependent connecting leg is marked `affected`.
* **Scenario D (Unrelated booking):** Separate excursion with no dependency path is strictly marked `unaffected`.
* **Scenario E (Hotel uncertainty):** Hotel following disrupted journey is not marked lost or cancelled.
* **Scenario F (Graph validation):** Rejects nonexistent booking references, self-dependencies, and cyclic dependency graphs.

---

## 8. License

MIT
