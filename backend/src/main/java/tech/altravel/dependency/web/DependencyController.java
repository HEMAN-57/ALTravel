package tech.altravel.dependency.web;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tech.altravel.dependency.dto.CreateDependencyRequest;
import tech.altravel.dependency.dto.DependencyResponse;
import tech.altravel.dependency.service.DependencyService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/trips/{tripId}/dependencies")
public class DependencyController {

    private final DependencyService dependencyService;

    public DependencyController(DependencyService dependencyService) {
        this.dependencyService = dependencyService;
    }

    @PostMapping
    public ResponseEntity<DependencyResponse> createDependency(
            @PathVariable String tripId,
            @Valid @RequestBody CreateDependencyRequest request
    ) {
        DependencyResponse response = dependencyService.createDependency(tripId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<DependencyResponse>> getDependencies(@PathVariable String tripId) {
        return ResponseEntity.ok(dependencyService.getDependenciesByTripId(tripId));
    }

    @DeleteMapping("/{dependencyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDependency(
            @PathVariable String tripId,
            @PathVariable String dependencyId
    ) {
        dependencyService.deleteDependency(tripId, dependencyId);
    }
}
