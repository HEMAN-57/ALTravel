# ALTravel — When travel goes wrong, find your next best move.

**ALTravel** is a travel disruption recovery and traveller protection web application. When a flight or train is delayed or cancelled, ALTravel models connected bookings, identifies downstream consequences across hotels and activities, compares recovery options, and generates a deadline-ordered action plan.

> **Status:** Milestone 1 — Project Foundation completed. Independent, deterministic domain models and local-first architecture established.

---

## 1. Product Vision

Travel bookings do not exist in isolation:
* A 2-hour flight delay can cause an airport check-in cutoff to be missed for an onward connection.
* Arriving 6 hours late can cause a hotel to mark a reservation as a "no-show" and release the room.
* Missing an arrival window forfeits prepaid non-refundable excursions (such as scuba diving, guided tours, or event tickets).

ALTravel provides travellers with clarity and decisive recovery strategies when disruptions occur.

---

## 2. Technology Stack

* **UI Framework:** React (v18.3.1) with StrictMode
* **Language:** TypeScript with strict type checking (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noEmit`)
* **Build Tool & Dev Server:** Vite
* **Styling & Design System:** Tailwind CSS with custom HSL tokens, accessible focus rings, and responsive typography
* **Component Architecture:** Inspired by shadcn/ui (composable, headless-ready primitives with `clsx` and `tailwind-merge`)
* **Icons:** Lucide Icons (`lucide-react`)
* **Persistence:** Browser `localStorage` with graceful validation and corruption fallback
* **Testing:** Vitest with jsdom environment and `@testing-library/react`
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
│   ├── domain/                 # Pure TypeScript domain models and deterministic rules
│   │   ├── trips/              # Trip types and strict validation
│   │   └── bookings/           # Booking types, status/type invariants, and validation
│   ├── lib/                    # Storage and utilities
│   │   ├── demo-data.ts        # Synthetic demonstration trip (Hyderabad → Goa)
│   │   ├── storage.ts          # Resilient, isolated localStorage adapter
│   │   └── utils.ts            # Formatting (currency, date) and class merger
│   ├── test/                   # Vitest unit test suites
│   │   ├── setup.ts            # Global test setup and Storage mock
│   │   ├── domain.test.ts      # Domain validation and invariant tests
│   │   ├── storage.test.ts     # Corruption handling & isolation tests
│   │   └── sample-trip.test.ts # Simulated fixture integrity tests
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

### Separation of Concerns:
1. **Domain (`src/domain/`)**: Pure, framework-agnostic TypeScript types and validation routines. Domain models enforce validation rules (e.g. end date cannot precede start date, costs cannot be negative, deadlines must be valid timestamps). Missing information is explicitly represented as `undefined` rather than inventing synthetic policies.
2. **Persistence (`src/lib/storage.ts`)**: Encapsulates all browser storage. Deserialization validates every item through domain validators; corrupted or malformed entries are discarded without blowing up the application. Storage operations use targeted keys (`altravel_trips_v1`), ensuring user data in other applications on the same origin is never cleared.
3. **Presentation (`src/components/` & `src/features/`)**: React components consume domain models and invoke persistence through pure handlers. UI components use semantic HTML, accessible ARIA roles, and clear interactive feedback.

---

## 4. Current Milestone Scope (Milestone 1)

Implemented in Milestone 1:
- Application shell with navigation (Dashboard, My Trips, Recovery Planner)
- Responsive layout for mobile and desktop screens
- Strongly typed domain models for Trips and Bookings
- Synthetic demo trip (Hyderabad to Goa) with flight, hotel, and scuba diving
- Fully functional custom trip creation and booking addition
- Resilient localStorage persistence with reset and corrupt-data recovery
- 22 passing unit tests in Vitest covering domain logic and storage
- Zero TypeScript and ESLint warnings/errors

---

## 5. Features Explicitly Not Implemented Yet (Milestone 2+)

Per the Milestone 1 project boundaries, the following are deferred to subsequent milestones:
- Disruption propagation engine (downstream delay & missed connection calculation)
- Recovery optimization and Pareto filtering (comparing trade-offs between cost, time, and comfort)
- Deadline-ordered action plan generation
- Live airline, train (IRCTC), or hotel API integrations
- Calendar integrations (.ics, Google Calendar)
- Price & Trust Check extension
- Backend servers (Spring Boot/Node/Django), relational databases, or user authentication

---

## 6. Prerequisites

* **Node.js**: v18.0.0 or later (v20+ or v26 supported)
* **npm**: v9.0.0 or later

---

## 7. Installation & Development Commands

### Install dependencies
```bash
npm install
```

### Start the development server
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

### Preview production build
```bash
npm run preview
```

---

## 8. Instructions for Loading and Testing the Sample Trip

1. Launch the application with `npm run dev`.
2. On the **Dashboard**, click the button labelled **"Load Sample Trip (Hyderabad → Goa)"** (or click it from the empty state).
3. The sample trip **"Goa Coastal Getaway (Simulated Demo)"** will be loaded and persisted to browser localStorage.
4. Click **"View Trip Details"** or navigate to **"My Trips"**:
   - Notice the prominent **"Simulated Demo Data"** badge and disclaimer explaining that all flight numbers, schedules, resort policies, and dive fees are simulated test fixtures.
   - Inspect the three connected bookings:
     1. **IndiGo 6E-532 (Flight)**: Hyderabad (HYD) to Goa (GOI), departure at 08:15 AM, arrival at 09:40 AM. Contains airport check-in cutoff deadline.
     2. **Taj Exotica Resort & Spa (Hotel)**: 4-night stay with check-in at 14:00 and strict 48-hour prior cancellation cutoff.
     3. **Grande Island Scuba Adventures (Activity)**: Prepaid diving excursion at 07:30 AM next morning with strict 24-hour cutoff.
5. Add a new booking segment or create a custom trip to test persistence.
6. Refresh the browser page (`Cmd+R` / `F5`) — your trips and bookings remain intact.
7. To safely clear only ALTravel storage, click **"Reset Data"** in the top navigation bar.

---

## 9. License

MIT
