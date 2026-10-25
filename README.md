# ALTravel — When travel goes wrong, find your next best move.

**ALTravel** is an intelligent travel disruption recovery and traveller protection web application. When a flight or train is delayed or cancelled, ALTravel models connected bookings as an explicit dependency graph, deterministically identifies downstream consequences across connecting transport, lodging, and prepaid activities, objectively compares recovery alternatives under user-defined priorities, and generates a sequenced, deadline-ordered action plan.

> **Evaluation Status:** Complete Working MVP (Milestones 1, 2, 2.1, 3, and 3.1 completed).  
> **Test Suite:** **113 passing tests** across 7 test suites (100% pass rate).  
> **Type Safety:** 100% strict TypeScript (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, zero `any`).

---

## 1. Problem Statement & Target Users

### The Problem
When travel disruptions strike (a flight delay, a missed connection, or a cancelled train leg), travellers face chaotic, high-stress decision environments:
1. **Hidden Cascading Impacts:** A 60-minute delay may be safely absorbed by a layover buffer, whereas a 90-minute delay breaks a connection or causes a traveller to miss a non-refundable prepaid activity.
2. **False Financial Assumptions:** Travellers frequently panic and assume late arrival means their hotel room is forfeited or non-refundable, when hotel policies often provide flexible 24-hour reception windows.
3. **Flawed Single-Metric Optimization:** Booking engines focus solely on cheapest ticket price or fastest flight, ignoring that an inexpensive train arriving late in the evening might cause ₹4,200 in non-refundable activity loss.
4. **Action Paralysis:** Travellers struggle to know what to do first—whether to call the hotel, rebook a seat before inventory expires, or request a refund on a disrupted segment.

### Intended Users
* **Independent Travellers & Commuters:** Managing multi-leg journeys composed of flights, trains, hotel stays, and time-sensitive prepaid tours.
* **Travel Concierges & Assistants:** Evaluating trade-offs quickly to advise stranded clients with clear evidence, financial clarity, and prioritized action steps.
* **Evaluators & Engineers:** Demonstrating deterministic domain modeling, Directed Acyclic Graph (DAG) consequence propagation, multi-criteria recovery optimization, and resilient browser-first architecture.

---

## 2. Core Workflow & Key Features

```
[ Itinerary Modeling ] ──> [ Disruption Simulation ] ──> [ Consequence Propagation ]
                                                                     │
[ Action Plan Checklist ] <── [ Multi-Priority Ranking ] <── [ Recovery Plan Comparison ]
```

### 1. Itinerary & Explicit Dependency Graph
* **Structured Bookings:** Captures flights, trains, hotels, and activities with timing, pricing, booking status, and cancellation policies.
* **Explicit Dependencies:** Downstream impacts are **never guessed** merely because bookings belong to the same trip. Relationships are explicitly modeled with required buffer times (`requiredBufferMinutes`) and commitment levels (`hard` vs `flexible`).
* **Graph Validation:** Cycle detection via Depth-First Search (DFS) ensures valid, directed dependency graphs with zero circular references.

### 2. Deterministic Disruption Propagation Engine
* Evaluates delays and cancellations against buffer thresholds and check-in cutoffs.
* Categorizes each booking into unambiguous statuses:
  - `affected`: Definite failure (buffer deficit, missed deadline, cancelled upstream leg).
  - `atRisk`: Potential impact requiring attention (e.g., late arrival at a hotel with flexible reception).
  - `unaffected`: Sufficient transfer buffer or completely independent branch of travel.
  - `unknown`: Missing or incomplete schedule data prevents deterministic evaluation.
* **Evidence-Backed Explanations:** Every status is accompanied by hand-calculated mathematical proofs (e.g., `Available transfer: 20 min. Required buffer: 45 min. Buffer deficit: 25 min`).

### 3. Candidate Recovery Plan Comparison
* Groups compatible travel options into coherent recovery plans (e.g., pairing an alternative flight with a compatible ground cab, avoiding incompatible multi-mode transit combinations).
* Separates financial dimensions with strict accounting discipline:
  - **Additional Spending:** Out-of-pocket money required to purchase new recovery tickets.
  - **Non-Refundable Cash Loss:** Original booking costs that are confirmed lost under recorded cancellation policies.
  - **Unknown Refund Cash at Risk:** Booking amounts where policy cutoff cannot be determined from available data and requires provider inquiry.
  - **Lost Experience Value:** Subjective personal value assigned to activities (e.g. Scuba Diving = 85 pts), kept separate from currency.

### 4. Multi-Criteria Priority Ranking
Supports three distinct user recovery strategies:
1. **Preserve Activity (`preserve-activity`):** Prioritizes saving prepaid tours and high-value experiences, minimizing lost commitments.
2. **Minimize Additional Spending (`minimize-cost`):** Prioritizes keeping out-of-pocket recovery expenses as low as possible.
3. **Arrive Earliest (`earliest-arrival`):** Prioritizes reaching the final destination at the earliest possible clock time.

### 5. Feasibility & Fallback Enforcement
* Allows travellers to set a **Hard Budget Limit** or designate **Non-Negotiable Critical Bookings**.
* Plans that violate these constraints are not silently deleted; they are explicitly flagged as **Infeasible Fallbacks** with detailed explanations. Feasible options always rank strictly above infeasible fallbacks.

### 6. Sequenced Action Plan
* Generates an actionable, ordered checklist for executing the selected recovery plan.
* Respects prerequisite dependencies (e.g., rebook alternative flight *before* cancelling disrupted ticket or booking destination cab).
* Strictly sorts by known deadline timestamps first, placing items with unconfirmed deadlines at the end with explicit `"Confirm deadline with provider"` instructions.

---

## 3. Technology Stack & Architectural Principles

| Layer | Technology | Rationale |
|---|---|---|
| **UI Framework** | React 18 (with StrictMode) | Modern declarative UI with immediate reactivity. |
| **Language** | TypeScript (Strict mode) | `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`. Zero runtime `any`. |
| **Styling** | Tailwind CSS (Tailwind v3) | Custom HSL token design system, accessible focus rings, and dark-mode compatible palettes. |
| **Component Design** | Composable Primitives | Headless, accessible primitives (`Button`, `Card`, `Badge`, `Modal`, `Input`, `Select`, `Alert`). |
| **Icons** | Lucide React | Consistent, lightweight iconography for transport types and alert levels. |
| **Persistence** | Browser `localStorage` | Resilient client storage with JSON schema validation, corruption recovery, and quota handling. |
| **Testing** | Vitest + Testing Library | Blazing-fast unit and component test runner with DOM simulation. |
| **Build Tool** | Vite 6 | Sub-second HMR and optimized production bundling. |

> **Architectural Decision:** ALTravel is intentionally built with zero backend dependencies (no Spring Boot, Django, or Express) and zero external databases. All propagation, ranking, and validation logic runs as **pure, deterministic TypeScript functions** in the client, ensuring instant offline capability, zero hosting cost, and bulletproof demonstration reliability.

---

## 4. System Architecture

### 4.1 Architecture Diagram

```mermaid
graph TD
    subgraph UI Presentation Layer
        App[AppShell & Navigation]
        TripDetail[TripDetailView & BookingItem]
        DisruptionPanel[Disruption Simulator Form]
        RecoveryView[RecoveryPlannerView]
        PlanCards[Recovery Plan Comparison Cards]
        ActionChecklist[Sequenced Action Plan Checklist]
    end

    subgraph State & Persistence Layer
        Storage[src/lib/storage.ts]
        LocalStorage[(Browser LocalStorage)]
        DemoData[src/lib/demo-data.ts]
    end

    subgraph Domain Engine Layer (Pure TypeScript)
        TripVal[Trip & Booking Validators]
        DepVal[Graph Cycle & Dependency Validator]
        PropEngine[Disruption Propagation Engine]
        RecoveryEngine[Recovery Planning & Ranking Engine]
        RefundClassifier[Deterministic Policy & Refund Classifier]
    end

    %% UI to State
    App --> Storage
    Storage --> LocalStorage
    Storage -. loads fallback .-> DemoData

    %% UI to Domain
    TripDetail --> PropEngine
    DisruptionPanel --> PropEngine
    RecoveryView --> RecoveryEngine
    PlanCards --> ActionChecklist

    %% Domain flow
    TripVal --> PropEngine
    DepVal --> PropEngine
    PropEngine --> RecoveryEngine
    RefundClassifier --> RecoveryEngine
```

### 4.2 Codebase Structure

```text
src/
├── app/                        # Application metadata and global definitions
├── components/                 # Presentation design system
│   ├── layout/                 # AppShell, Navbar, Footer
│   └── ui/                     # Accessible UI primitives (Button, Card, Badge, Modal, Input, Select, Alert)
├── domain/                     # Pure, decoupled business domain logic
│   ├── trips/                  # Trip models, ID relationship validation, sample trip verification
│   │   ├── trip.types.ts
│   │   └── trip.validation.ts
│   ├── bookings/               # Booking contracts, timeline validation, and status invariants
│   │   ├── booking.types.ts
│   │   └── booking.validation.ts
│   ├── disruptions/            # Disruption propagation and DAG traversal engine
│   │   ├── dependency.types.ts       # BookingDependency, relationship & commitment types
│   │   ├── dependency.validation.ts  # Graph cycle detection (DFS), missing reference checks
│   │   ├── disruption.types.ts       # DisruptionInput, ImpactStatus, BookingImpact evidence
│   │   ├── disruption.validation.ts  # Delay/cancellation payload validators
│   │   └── propagation.engine.ts     # Multi-leg buffer propagation engine
│   └── recovery/               # Recovery comparison, ranking, and action plan engine
│       ├── recovery.types.ts         # RecoveryOption, RecoveryPlan, ActionItem, Priorities
│       └── recovery.engine.ts        # Plan grouping, feasibility enforcement, deterministic refunds
├── features/                   # Application view controllers
│   ├── trips/                  # Trip overview, booking cards, and creation modals
│   │   ├── TripDetailView.tsx
│   │   ├── BookingItem.tsx
│   │   ├── CreateTripModal.tsx
│   │   └── CreateBookingModal.tsx
│   └── recovery/               # Recovery planning dashboard and candidate option modal
│       ├── RecoveryPlannerView.tsx
│       └── AddRecoveryOptionModal.tsx
├── lib/                        # Storage adapters and utility helpers
│   ├── demo-data.ts            # Synthetic Hyderabad → Goa demonstration trip
│   ├── storage.ts              # Resilient localStorage adapter with explicit save verification
│   └── utils.ts                # Formatting (INR currency, dates, class name merger)
├── test/                       # Comprehensive Vitest test suites (113 tests)
│   ├── setup.ts                # Vitest global setup & Storage mock
│   ├── domain.test.ts          # Domain validation and trip-booking invariant tests (19 tests)
│   ├── propagation.test.ts     # Disruption propagation Scenarios A–F & multi-leg tests (38 tests)
│   ├── recovery.test.ts        # Recovery planning, ranking, and refund classification tests (23 tests)
│   ├── storage.test.ts         # Persistence, save failure & quota overflow tests (13 tests)
│   ├── modal.test.tsx          # Accessible modal focus trap & keyboard tests (6 tests)
│   ├── app-persistence.test.tsx# App-level persistence error handling tests (3 tests)
│   └── sample-trip.test.ts     # Demo fixture data integrity tests (4 tests)
├── App.tsx                     # Main application state and view router
├── main.tsx                    # React DOM root entrypoint
└── index.css                   # Tailwind directives and theme design tokens
```

---

## 5. Local Setup & Execution Guide

### Prerequisites
* **Node.js:** v18.0.0 or later (Node 20+ recommended)
* **npm:** v9.0.0 or later

### 1. Clone & Install
```bash
git clone https://github.com/HEMAN-57/ALTravel.git
cd ALTravel
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173` (or the port indicated in terminal output).

### 3. Run Quality & Verification Commands

| Command | Purpose | Verification Outcome |
|---|---|---|
| `npm run test` | Run complete unit & integration test suite | **113 passed** (7 test suites) |
| `npm run typecheck` | Run TypeScript compiler in `--noEmit` mode | **0 errors** (strict mode enabled) |
| `npm run lint` | Run ESLint across all codebase files | **0 errors, 0 warnings** |
| `npm run build` | Compile and bundle production application | **Successfully built in < 2.0s** (`dist/`) |

---

## 6. Verified Test Results

The repository includes **113 deterministic automated tests** executing across 7 test files:

```text
 ✓ src/test/domain.test.ts (19 tests)
 ✓ src/test/sample-trip.test.ts (4 tests)
 ✓ src/test/storage.test.ts (13 tests)
 ✓ src/test/propagation.test.ts (38 tests)
 ✓ src/test/recovery.test.ts (23 tests)
 ✓ src/test/modal.test.tsx (6 tests)
 ✓ src/test/app-persistence.test.tsx (3 tests)

 Test Files  7 passed (7)
      Tests  113 passed (113)
   Duration  3.48s
```

### Key Verified Scenarios
* **Propagation Engine:**
  - **Scenario A (Connection Survives):** 60 min delay with 120 min available window leaves 60 min buffer &ge; 45 min required &rarr; `unaffected`.
  - **Scenario B (Connection Missed):** 100 min delay leaves 20 min available transfer &lt; 45 min required (25 min deficit) &rarr; `affected`.
  - **Scenario C (Cancellation Propagation):** Upstream cancellation propagates downstream failure across all connected transport and hard commitments.
  - **Scenario D (Independent Excursion):** Bookings without dependency edges remain strictly `unaffected`.
  - **Scenario E (Hotel Uncertainty Rule):** Delayed/cancelled transport flags hotel check-in as `atRisk` or `unaffected`, never assuming room forfeiture when reception is flexible.
  - **Scenario F (Graph Cycle Detection):** Depth-first search rejects circular dependencies and nonexistent booking references.
* **Recovery Planning & Financial Discipline:**
  - **Deterministic Policy Classifier:** Replaces non-deterministic clock calls with explicit reference timestamps; records unconfirmed policies as `unknown` instead of falsely assuming refundability.
  - **Option Compatibility Grouping:** Strictly prevents pairing incompatible transit options (e.g. airport taxis are never combined with train departures from distant railway stations).
  - **Feasibility Thresholds:** Budget overruns and missed critical commitments trigger `isFallback: true` and rank below all feasible solutions.

---

## 7. Scope Boundaries & Explicit Limitations

To maintain academic and professional integrity, ALTravel explicitly states its system boundaries:

1. **Simulated Travel Options:** All candidate recovery options, airlines, train schedules, and hotel providers are synthetic fixtures designed for architecture demonstration. ALTravel **does not query live GDS (Amadeus, Sabre) or flight tracking radars**.
2. **No Live Fare Availability:** Listed prices and seat availability are illustrative snapshots and do not guarantee live market inventory.
3. **No Direct Booking or Payment Integrations:** ALTravel does not charge credit cards or initiate API booking mutations with travel providers. Execution is guided via the Action Plan for the user to complete.
4. **No Guaranteed Refunds or Provider Acceptance:** Travel provider policies (airline cancellation charges, hotel late check-in waivers, excursion rescheduling) are subject to operator discretion. ALTravel produces deterministic policy evaluations based on recorded data, explicitly identifying unconfirmed policies as `unknown` requiring direct traveller confirmation.

---

## 8. Reproducible 3–5 Minute Evaluation Demo Script

Follow this script to demonstrate ALTravel to evaluators using the built-in synthetic **Hyderabad → Goa** itinerary:

| Step & Timestamp | User Action in Browser | What the Evaluator Sees | Key Talking Points |
|---|---|---|---|
| **Step 1 (0:00–0:45)**<br>*Itinerary & Graph Overview* | 1. Open `http://localhost:5173`.<br>2. Click **"Load Demo Itinerary"** button. | * Dashboard loads "Goa Coastal Getaway".<br>* 3 connected bookings appear: Flight (IndiGo HYD&rarr;GOI), Hotel (Taj Exotica Resort), Activity (Grande Island Scuba).<br>* Explicit dependency badges display buffer requirements. | * "ALTravel models journeys as an explicit dependency graph rather than isolated bookings."<br>* "Notice that Flight &rarr; Scuba has a strict 12-hour overnight buffer requirement." |
| **Step 2 (0:45–1:30)**<br>*Disruption Simulation* | 1. Switch to **"Disruption & Consequence Assessment"** tab.<br>2. Select Flight leg.<br>3. Enter `240` minutes (4-hour delay).<br>4. Click **"Assess Impact"**. | * Flight is marked `disrupted (delayed 240m)`.<br>* Hotel remains `unaffected` (flexible check-in window up to 23:59).<br>* Scuba Diving is marked `affected` (buffer deficit of 160 minutes; arrival 13:40 leaves insufficient rest). | * "Notice our Hotel Uncertainty Rule: late arrival does not falsely claim the room is cancelled."<br>* "The engine mathematically proves the scuba failure with explicit evidence." |
| **Step 3 (1:30–2:30)**<br>*Recovery Comparison & Priority Ranking* | 1. Navigate to **"Recovery Planner"** tab.<br>2. Observe default ranking (**"Preserve Activities"**).<br>3. Toggle priority to **"Minimize Additional Spending"**.<br>4. Toggle priority to **"Arrive Earliest"**. | * Under **Preserve Activities**, **Plan A (Alternative Flight + Direct Cab)** is recommended (#1 rank). It costs ₹5,400 extra, arrives at 14:15, and preserves both Hotel and Scuba.<br>* Under **Minimize Spending**, **Plan B (Budget Train)** takes #1 rank. It costs only ₹950 extra, but arrives at 20:30 and forfeits the Scuba tour.<br>* Note the financial breakdown: Plan B shows ₹950 additional spending but flags ₹4,200 non-refundable cash loss. | * "The engine cleanly isolates out-of-pocket spending from non-refundable cash loss."<br>* "Under cost-minimization, the train seems cheaper (₹950), but the traveller immediately sees they forfeit ₹4,200 in scuba diving." |
| **Step 4 (2:30–3:15)**<br>*Feasibility & Constraint Enforcement* | 1. In the constraints sidebar, enter `3000` into **Max Recovery Budget (INR)**.<br>2. Observe the comparison view. | * Plan A (₹5,400) is immediately marked with a red **"Infeasible Fallback"** badge.<br>* Rejection reason is displayed: *Exceeds maximum recovery budget limit of 3000 INR*.<br>* Plan B (₹950) now becomes the sole feasible recommendation. | * "ALTravel does not silently hide infeasible plans; it displays them as fallback options with explicit constraint violation reasons."<br>* "Feasible plans are always strictly ranked above infeasible fallbacks." |
| **Step 5 (3:15–4:00)**<br>*Sequenced Action Plan* | 1. Clear the budget cap.<br>2. Select **Plan A (Alternative Flight + Direct Cab)**.<br>3. Scroll down to the **"Prioritized Action Plan"** checklist. | * A numbered, chronological action list appears:<br>  1. Book Alternative Flight (IndiGo alternative, deadline 10:15).<br>  2. Call Taj Exotica for late check-in guarantee (deadline 18:00).<br>  3. Arrange direct airport cab (flagged: *Confirm deadline with provider*).<br>* Interactive checkboxes track execution progress. | * "Travellers under stress don't need raw data; they need an exact, deadline-ordered sequence."<br>* "Notice that actions with confirmed deadlines are strictly ordered first, while unknown deadlines prompt provider verification." |

---

## 9. Tested Visual Artifacts & Verified Screenshots

The demonstration workflow has been tested and recorded. Key artifacts stored in the project artifact directory:

* **Sample Itinerary Dashboard:** [`altravel_sample_trip_loaded_1792923691304.png`](file:///Users/himanshu/.gemini/antigravity-ide/brain/c1f7b457-c3f5-42c6-acd9-1487a0d81cf4/altravel_sample_trip_loaded_1792923691304.png)  
  *Shows loaded Hyderabad &rarr; Goa itinerary with bookings, cost totals, and explicit dependency tags.*
* **Disruption Propagation View:** [`altravel_trip_detail_view_1792923721268.png`](file:///Users/himanshu/.gemini/antigravity-ide/brain/c1f7b457-c3f5-42c6-acd9-1487a0d81cf4/altravel_trip_detail_view_1792923721268.png)  
  *Demonstrates 4-hour flight delay propagation, showing flexible hotel preservation and scuba buffer violation.*
* **Preserve Activities Ranking:** [`recovery_planner_page_1792928878473.png`](file:///Users/himanshu/.gemini/antigravity-ide/brain/c1f7b457-c3f5-42c6-acd9-1487a0d81cf4/recovery_planner_page_1792928878473.png)  
  *Displays Plan A as #1 recommended recovery option saving all commitments.*
* **Cost Minimization Ranking:** [`minimize_spending_priority_1792928918129.png`](file:///Users/himanshu/.gemini/antigravity-ide/brain/c1f7b457-c3f5-42c6-acd9-1487a0d81cf4/minimize_spending_priority_1792928918129.png)  
  *Demonstrates dynamic re-ranking to Plan B (Budget Train), highlighting financial trade-offs.*
* **Earliest Arrival Ranking:** [`arrive_earliest_priority_1792928935812.png`](file:///Users/himanshu/.gemini/antigravity-ide/brain/c1f7b457-c3f5-42c6-acd9-1487a0d81cf4/arrive_earliest_priority_1792928935812.png)  
  *Shows arrival-optimized ranking reaching destination at 14:15.*
* **Full Browser Execution Video:** [`milestone31_correctness_pass_1792928848730.webp`](file:///Users/himanshu/.gemini/antigravity-ide/brain/c1f7b457-c3f5-42c6-acd9-1487a0d81cf4/milestone31_correctness_pass_1792928848730.webp)  
  *Complete animated recording verifying interactive behavior, priority switches, and action plan toggling.*

---

## 10. Policy & Financial Discipline

ALTravel maintains strict separation between **recorded facts**, **heuristics**, and **unknowns**:

1. **No Phantom Refund Promises:** A booking is only classified as refundable or non-refundable if supported by recorded policy dates and explicit cutoffs. If policy data is missing or vague, it is recorded as `unknown` with an explicit notice: *"Must be confirmed directly with provider"*.
2. **Separation of Cash Flows:**
   - **Out-of-Pocket Spending:** Added cash needed today to book a new ticket.
   - **Non-Refundable Forfeited Cost:** Money paid previously that cannot be recovered.
   - **Experience Value:** Abstract points (0–100) reflecting personal holiday value, never converted into counterfeit financial figures.
3. **Deterministic Evaluation Time:** Policy deadlines are evaluated against an explicit reference timestamp rather than nondeterministic `Date.now()`, ensuring 100% reproducible test suites across all environments.

---

## 11. Submission Metadata

* **Repository:** `HEMAN-57/ALTravel`
* **Branch:** `main`
* **Target Audience:** Academic Evaluation / College Capstone Demonstration
* **License:** MIT
