package tech.altravel.demo.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.altravel.demo.dto.DemoSeedResponse;
import tech.altravel.demo.service.DemoSeedService;

@RestController
@RequestMapping("/api/v1/demo")
public class DemoController {

    private final DemoSeedService demoSeedService;

    public DemoController(DemoSeedService demoSeedService) {
        this.demoSeedService = demoSeedService;
    }

    @PostMapping("/seed")
    public ResponseEntity<DemoSeedResponse> seedDemoTrip() {
        DemoSeedResponse response = demoSeedService.seedDemoTrip();
        if (response.seeded()) {
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } else {
            return ResponseEntity.ok(response);
        }
    }
}
