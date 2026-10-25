package tech.altravel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.HealthComponent;
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.boot.actuate.health.Status;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

class AltravelBackendApplicationTests extends PostgresIntegrationTestBase {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private HealthEndpoint healthEndpoint;

    @Test
    @DisplayName("1. Application context starts and connects to PostgreSQL")
    void contextLoads() throws SQLException {
        assertThat(dataSource).isNotNull();
        try (Connection connection = dataSource.getConnection()) {
            assertThat(connection.isValid(2)).isTrue();
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
        }
    }

    @Test
    @DisplayName("2. Actuator health endpoint reports UP status with database check")
    void healthEndpointIsUp() {
        HealthComponent health = healthEndpoint.health();
        assertThat(health.getStatus()).isEqualTo(Status.UP);
    }
}
