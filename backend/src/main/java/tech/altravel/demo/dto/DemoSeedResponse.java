package tech.altravel.demo.dto;

import tech.altravel.trip.dto.TripResponse;

public record DemoSeedResponse(
        boolean seeded,
        String message,
        TripResponse trip
) {
}
