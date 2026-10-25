package tech.altravel;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base integration test using a shared, singleton PostgreSQL 16 container
 * across all integration test suites for fast and reliable execution.
 */
@SpringBootTest
public abstract class PostgresIntegrationTestBase {

    protected static final PostgreSQLContainer<?> postgres;

    static {
        postgres = new PostgreSQLContainer<>("postgres:16.4-alpine")
                .withDatabaseName("altravel_test")
                .withUsername("altravel_test")
                .withPassword("altravel_test");
        postgres.start();
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
