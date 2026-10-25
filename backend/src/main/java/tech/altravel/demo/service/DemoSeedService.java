package tech.altravel.demo.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tech.altravel.booking.domain.BookingEntity;
import tech.altravel.booking.domain.BookingRepository;
import tech.altravel.demo.dto.DemoSeedResponse;
import tech.altravel.dependency.domain.BookingDependencyEntity;
import tech.altravel.dependency.domain.BookingDependencyRepository;
import tech.altravel.trip.domain.TripEntity;
import tech.altravel.trip.domain.TripRepository;
import tech.altravel.trip.dto.TripResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class DemoSeedService {

    public static final String DEMO_TRIP_ID = "demo-trip-hyd-goa";
    public static final String DEMO_FLIGHT_ID = "demo-booking-flight-1";
    public static final String DEMO_HOTEL_ID = "demo-booking-hotel-1";
    public static final String DEMO_SCUBA_ID = "demo-booking-scuba-1";

    public static final String DEMO_DEP_FLIGHT_HOTEL_ID = "demo-dep-flight-hotel";
    public static final String DEMO_DEP_FLIGHT_SCUBA_ID = "demo-dep-flight-scuba";

    private final TripRepository tripRepository;
    private final BookingRepository bookingRepository;
    private final BookingDependencyRepository dependencyRepository;

    public DemoSeedService(TripRepository tripRepository,
                           BookingRepository bookingRepository,
                           BookingDependencyRepository dependencyRepository) {
        this.tripRepository = tripRepository;
        this.bookingRepository = bookingRepository;
        this.dependencyRepository = dependencyRepository;
    }

    public DemoSeedResponse seedDemoTrip() {
        if (tripRepository.existsById(DEMO_TRIP_ID)) {
            TripEntity existing = tripRepository.findById(DEMO_TRIP_ID).orElseThrow();
            return new DemoSeedResponse(
                    false,
                    "Demo trip '" + DEMO_TRIP_ID + "' already exists; skipping re-seed to preserve user modifications.",
                    TripResponse.fromEntity(existing)
            );
        }

        TripEntity trip = new TripEntity(
                DEMO_TRIP_ID,
                "Goa Coastal Getaway (Simulated Demo)",
                "Hyderabad (HYD)",
                "Goa (GOI)",
                LocalDate.of(2026, 11, 12),
                LocalDate.of(2026, 11, 16),
                true,
                "Synthetic demonstration itinerary modelling an outbound flight from Hyderabad to Goa, followed by a beachfront resort stay and a prepaid scuba diving excursion. All provider names, schedules, policies, and costs are simulated for architecture demonstration."
        );
        tripRepository.save(trip);

        BookingEntity flight = new BookingEntity(
                DEMO_FLIGHT_ID,
                trip,
                "flight",
                "IndiGo 6E-532 (Simulated)",
                "RGIA Hyderabad (HYD) → Dabolim Airport, Goa (GOI)",
                Instant.parse("2026-11-12T02:45:00Z"),
                Instant.parse("2026-11-12T04:10:00Z"),
                new BigDecimal("4850.00"),
                "INR",
                "confirmed"
        );
        flight.setArrivalDeadline(Instant.parse("2026-11-12T01:45:00Z"));
        flight.setCancellationDeadline(Instant.parse("2026-11-12T00:45:00Z"));
        flight.setCancellationPolicyNotes("Simulated policy: Airline cancellation fee ₹3,000 applies up to 2 hours prior to scheduled departure. Non-refundable thereafter.");
        flight.setConfirmationReference("6E-SIM-8921");
        flight.setNotes("Flight operates out of Hyderabad Terminal 1. Baggage allowance: 15kg check-in, 7kg cabin.");

        BookingEntity hotel = new BookingEntity(
                DEMO_HOTEL_ID,
                trip,
                "hotel",
                "Taj Exotica Resort & Spa, Goa (Simulated)",
                "Benaulim Beach, South Goa, India",
                Instant.parse("2026-11-12T08:30:00Z"),
                Instant.parse("2026-11-16T05:30:00Z"),
                new BigDecimal("36000.00"),
                "INR",
                "confirmed"
        );
        hotel.setArrivalDeadline(Instant.parse("2026-11-12T18:29:00Z"));
        hotel.setCancellationDeadline(Instant.parse("2026-11-10T08:30:00Z"));
        hotel.setCancellationPolicyNotes("Simulated policy: 100% refund if cancelled at least 48 hours before check-in. First night room charge retained for late cancellations.");
        hotel.setConfirmationReference("TAJ-GOA-7741");
        hotel.setNotes("Standard Deluxe Room with ocean view. Check-in from 14:00; early check-in subject to availability.");

        BookingEntity scuba = new BookingEntity(
                DEMO_SCUBA_ID,
                trip,
                "activity",
                "Grande Island Scuba Adventures (Simulated)",
                "Boat Jetty, Bogmalo / Grande Island, Goa",
                Instant.parse("2026-11-13T02:00:00Z"),
                Instant.parse("2026-11-13T08:00:00Z"),
                new BigDecimal("4200.00"),
                "INR",
                "confirmed"
        );
        scuba.setArrivalDeadline(Instant.parse("2026-11-13T01:30:00Z"));
        scuba.setCancellationDeadline(Instant.parse("2026-11-12T02:00:00Z"));
        scuba.setCancellationPolicyNotes("Simulated policy: Fully prepaid. Free reschedule up to 24 hours prior; non-refundable within 24h due to reserved dive vessel slot and instructor assignment.");
        scuba.setConfirmationReference("DIVE-GOA-4412");
        scuba.setNotes("Includes 1 guided dive, safety briefing, gear rental, and underwater photos. High dependency on morning arrival.");

        bookingRepository.saveAll(List.of(flight, hotel, scuba));

        BookingDependencyEntity depFlightHotel = new BookingDependencyEntity(
                DEMO_DEP_FLIGHT_HOTEL_ID,
                trip,
                DEMO_FLIGHT_ID,
                DEMO_HOTEL_ID,
                "arrival-to-lodging",
                120,
                "flexible",
                "Flight arrival feeds into resort check-in; flexible evening reception."
        );

        BookingDependencyEntity depFlightScuba = new BookingDependencyEntity(
                DEMO_DEP_FLIGHT_SCUBA_ID,
                trip,
                DEMO_FLIGHT_ID,
                DEMO_SCUBA_ID,
                "arrival-to-activity",
                720,
                "hard",
                "Arrival in Goa prior to next morning prepaid dive boat cutoff."
        );

        dependencyRepository.saveAll(List.of(depFlightHotel, depFlightScuba));

        return new DemoSeedResponse(
                true,
                "Demo trip '" + DEMO_TRIP_ID + "' successfully seeded.",
                TripResponse.fromEntity(trip)
        );
    }
}
