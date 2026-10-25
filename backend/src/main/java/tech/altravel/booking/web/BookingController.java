package tech.altravel.booking.web;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tech.altravel.booking.dto.BookingResponse;
import tech.altravel.booking.dto.CreateBookingRequest;
import tech.altravel.booking.dto.UpdateBookingRequest;
import tech.altravel.booking.service.BookingService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            @PathVariable String tripId,
            @Valid @RequestBody CreateBookingRequest request
    ) {
        BookingResponse response = bookingService.createBooking(tripId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> getBookings(@PathVariable String tripId) {
        return ResponseEntity.ok(bookingService.getBookingsByTripId(tripId));
    }

    @GetMapping("/{bookingId}")
    public ResponseEntity<BookingResponse> getBooking(
            @PathVariable String tripId,
            @PathVariable String bookingId
    ) {
        return ResponseEntity.ok(bookingService.getBooking(tripId, bookingId));
    }

    @PutMapping("/{bookingId}")
    public ResponseEntity<BookingResponse> updateBooking(
            @PathVariable String tripId,
            @PathVariable String bookingId,
            @Valid @RequestBody UpdateBookingRequest request
    ) {
        return ResponseEntity.ok(bookingService.updateBooking(tripId, bookingId, request));
    }

    @DeleteMapping("/{bookingId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBooking(
            @PathVariable String tripId,
            @PathVariable String bookingId
    ) {
        bookingService.deleteBooking(tripId, bookingId);
    }
}
