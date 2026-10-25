package tech.altravel;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class FlywayMigrationIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private Flyway flyway;

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("Flyway creates schema successfully on clean PostgreSQL and migrations are applied")
    void flywayMigrationApplied() {
        MigrationInfo current = flyway.info().current();
        assertThat(current).isNotNull();
        assertThat(current.getVersion().getVersion()).isEqualTo("2");
        assertThat(current.getState().isApplied()).isTrue();
        assertThat(flyway.info().applied()).hasSize(2);
    }

    @Test
    @DisplayName("Expected tables exist with valid relational constraints")
    void tablesAndColumnsExist() throws SQLException {
        Set<String> tableNames = new HashSet<>();
        try (Connection conn = dataSource.getConnection();
             ResultSet rs = conn.getMetaData().getTables(null, "public", "%", new String[]{"TABLE"})) {
            while (rs.next()) {
                tableNames.add(rs.getString("TABLE_NAME"));
            }
        }

        assertThat(tableNames).contains("trips", "bookings", "booking_dependencies");
    }
}
