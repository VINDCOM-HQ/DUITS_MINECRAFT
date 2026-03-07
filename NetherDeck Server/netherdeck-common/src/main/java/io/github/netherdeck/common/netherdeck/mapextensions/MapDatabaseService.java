package io.github.netherdeck.common.netherdeck.mapextensions;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.sql.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * JDBC-based database service for the map extension features.
 * Reads connection settings from the same {@code WEB_PORTAL_DB_*} environment
 * variables used by the SvelteKit web portal so both sides share one database.
 *
 * <p>This service handles all persistence for player trails, death markers,
 * respawn markers, land claim regions, and schema initialisation.
 *
 * <p>All methods are thread-safe — JDBC connections are obtained from a single
 * lazily-created {@link Connection} guarded by {@code synchronized} blocks.
 * For production use with high write rates the connection should be replaced
 * with a proper connection pool.
 */
public final class MapDatabaseService {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-MapDB");

    private final String host;
    private final int port;
    private final String user;
    private final String password;
    private final String database;

    private volatile Connection connection;
    private volatile boolean connected = false;

    public MapDatabaseService() {
        Map<String, String> env = System.getenv();
        this.host = env.getOrDefault("WEB_PORTAL_DB_HOST", "localhost");
        this.port = parsePort(env.getOrDefault("WEB_PORTAL_DB_PORT", "3306"));
        this.user = env.getOrDefault("WEB_PORTAL_DB_USER", "netherdeck");
        this.password = env.getOrDefault("WEB_PORTAL_DB_PASSWORD", "");
        this.database = env.getOrDefault("WEB_PORTAL_DB_NAME", "netherdeck");
    }

    /**
     * Establishes the JDBC connection.
     * @return {@code true} if connection succeeded, {@code false} otherwise
     */
    public boolean connect() {
        var url = String.format("jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                host, port, database);
        try {
            connection = DriverManager.getConnection(url, user, password);
            connected = true;
            LOGGER.info("[NetherDeck-MapDB] Connected to {}:{}/{}", host, port, database);
            return true;
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] Cannot connect to database: {}", e.getMessage());
            connected = false;
            return false;
        }
    }

    /**
     * Creates the map extension schema tables if they do not exist.
     * Safe to call repeatedly.
     */
    public synchronized void ensureSchema() {
        if (!connected) return;
        try (var stmt = connection.createStatement()) {
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS map_player_trails (
                  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
                  player_uuid VARCHAR(36) NOT NULL,
                  world      VARCHAR(64) NOT NULL,
                  x          DOUBLE NOT NULL,
                  y          DOUBLE NOT NULL,
                  z          DOUBLE NOT NULL,
                  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  INDEX idx_trail (player_uuid, world, recorded_at)
                ) CHARACTER SET utf8mb4
                """);
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS map_death_markers (
                  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
                  player_uuid VARCHAR(36),
                  player_name VARCHAR(64),
                  world       VARCHAR(64),
                  x           DOUBLE,
                  y           DOUBLE,
                  z           DOUBLE,
                  cause       VARCHAR(256),
                  died_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4
                """);
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS map_respawn_points (
                  player_uuid  VARCHAR(36) PRIMARY KEY,
                  player_name  VARCHAR(64),
                  world        VARCHAR(64),
                  x            DOUBLE,
                  y            DOUBLE,
                  z            DOUBLE,
                  set_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4
                """);
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS map_regions (
                  id         INT AUTO_INCREMENT PRIMARY KEY,
                  name       VARCHAR(128),
                  world      VARCHAR(64),
                  min_x      INT,
                  min_z      INT,
                  max_x      INT,
                  max_z      INT,
                  color      VARCHAR(16) DEFAULT '#3388ff',
                  owner      VARCHAR(64),
                  type       VARCHAR(32),
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) CHARACTER SET utf8mb4
                """);
            LOGGER.info("[NetherDeck-MapDB] Schema verified");
        } catch (SQLException e) {
            LOGGER.error("[NetherDeck-MapDB] Schema creation failed", e);
        }
    }

    // -------------------------------------------------------------------------
    // Player trails
    // -------------------------------------------------------------------------

    public synchronized void insertTrailPoint(String uuid, String world, double x, double y, double z) {
        if (!connected) return;
        try (var ps = connection.prepareStatement(
                "INSERT INTO map_player_trails (player_uuid, world, x, y, z) VALUES (?, ?, ?, ?, ?)")) {
            ps.setString(1, uuid);
            ps.setString(2, world);
            ps.setDouble(3, x);
            ps.setDouble(4, y);
            ps.setDouble(5, z);
            ps.executeUpdate();
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] insertTrailPoint failed: {}", e.getMessage());
        }
    }

    public synchronized void pruneTrails(int retentionHours) {
        if (!connected) return;
        try (var ps = connection.prepareStatement(
                "DELETE FROM map_player_trails WHERE recorded_at < DATE_SUB(NOW(), INTERVAL ? HOUR)")) {
            ps.setInt(1, retentionHours);
            int removed = ps.executeUpdate();
            if (removed > 0) {
                LOGGER.debug("[NetherDeck-MapDB] Pruned {} trail points older than {}h", removed, retentionHours);
            }
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] pruneTrails failed: {}", e.getMessage());
        }
    }

    public synchronized List<Map<String, Object>> getTrails(String world, String uuid, int hours) {
        var results = new ArrayList<Map<String, Object>>();
        if (!connected) return results;

        var sql = new StringBuilder(
                "SELECT player_uuid, world, x, y, z, recorded_at FROM map_player_trails WHERE 1=1");
        var params = new ArrayList<Object>();

        if (world != null && !world.isEmpty()) {
            sql.append(" AND world = ?");
            params.add(world);
        }
        if (uuid != null && !uuid.isEmpty()) {
            sql.append(" AND player_uuid = ?");
            params.add(uuid);
        }
        sql.append(" AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)");
        params.add(hours);
        sql.append(" ORDER BY player_uuid, recorded_at");

        try (var ps = connection.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (var rs = ps.executeQuery()) {
                while (rs.next()) {
                    var row = new HashMap<String, Object>();
                    row.put("uuid", rs.getString("player_uuid"));
                    row.put("world", rs.getString("world"));
                    row.put("x", rs.getDouble("x"));
                    row.put("y", rs.getDouble("y"));
                    row.put("z", rs.getDouble("z"));
                    row.put("t", rs.getTimestamp("recorded_at").getTime());
                    results.add(row);
                }
            }
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] getTrails failed: {}", e.getMessage());
        }
        return results;
    }

    // -------------------------------------------------------------------------
    // Death markers
    // -------------------------------------------------------------------------

    public synchronized void insertDeathMarker(String uuid, String name, String world,
                                                double x, double y, double z, String cause) {
        if (!connected) return;
        try (var ps = connection.prepareStatement(
                "INSERT INTO map_death_markers (player_uuid, player_name, world, x, y, z, cause) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)")) {
            ps.setString(1, uuid);
            ps.setString(2, name);
            ps.setString(3, world);
            ps.setDouble(4, x);
            ps.setDouble(5, y);
            ps.setDouble(6, z);
            ps.setString(7, cause);
            ps.executeUpdate();
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] insertDeathMarker failed: {}", e.getMessage());
        }
    }

    public synchronized List<Map<String, Object>> getDeathMarkers(String world) {
        var results = new ArrayList<Map<String, Object>>();
        if (!connected) return results;

        var sql = world != null && !world.isEmpty()
                ? "SELECT player_uuid, player_name, world, x, y, z, cause, died_at " +
                  "FROM map_death_markers WHERE world = ? ORDER BY died_at DESC LIMIT 500"
                : "SELECT player_uuid, player_name, world, x, y, z, cause, died_at " +
                  "FROM map_death_markers ORDER BY died_at DESC LIMIT 500";

        try (var ps = connection.prepareStatement(sql)) {
            if (world != null && !world.isEmpty()) {
                ps.setString(1, world);
            }
            try (var rs = ps.executeQuery()) {
                while (rs.next()) {
                    var row = new HashMap<String, Object>();
                    row.put("uuid", rs.getString("player_uuid"));
                    row.put("name", rs.getString("player_name"));
                    row.put("world", rs.getString("world"));
                    row.put("x", rs.getDouble("x"));
                    row.put("y", rs.getDouble("y"));
                    row.put("z", rs.getDouble("z"));
                    row.put("cause", rs.getString("cause"));
                    row.put("t", rs.getTimestamp("died_at").getTime());
                    results.add(row);
                }
            }
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] getDeathMarkers failed: {}", e.getMessage());
        }
        return results;
    }

    // -------------------------------------------------------------------------
    // Respawn markers
    // -------------------------------------------------------------------------

    public synchronized void upsertRespawnMarker(String uuid, String name, String world,
                                                   double x, double y, double z) {
        if (!connected) return;
        try (var ps = connection.prepareStatement(
                "INSERT INTO map_respawn_points (player_uuid, player_name, world, x, y, z) " +
                "VALUES (?, ?, ?, ?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE player_name=VALUES(player_name), world=VALUES(world), " +
                "x=VALUES(x), y=VALUES(y), z=VALUES(z)")) {
            ps.setString(1, uuid);
            ps.setString(2, name);
            ps.setString(3, world);
            ps.setDouble(4, x);
            ps.setDouble(5, y);
            ps.setDouble(6, z);
            ps.executeUpdate();
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] upsertRespawnMarker failed: {}", e.getMessage());
        }
    }

    public synchronized List<Map<String, Object>> getRespawnMarkers(String world) {
        var results = new ArrayList<Map<String, Object>>();
        if (!connected) return results;

        var sql = world != null && !world.isEmpty()
                ? "SELECT player_uuid, player_name, world, x, y, z FROM map_respawn_points WHERE world = ?"
                : "SELECT player_uuid, player_name, world, x, y, z FROM map_respawn_points";

        try (var ps = connection.prepareStatement(sql)) {
            if (world != null && !world.isEmpty()) {
                ps.setString(1, world);
            }
            try (var rs = ps.executeQuery()) {
                while (rs.next()) {
                    var row = new HashMap<String, Object>();
                    row.put("uuid", rs.getString("player_uuid"));
                    row.put("name", rs.getString("player_name"));
                    row.put("world", rs.getString("world"));
                    row.put("x", rs.getDouble("x"));
                    row.put("y", rs.getDouble("y"));
                    row.put("z", rs.getDouble("z"));
                    results.add(row);
                }
            }
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] getRespawnMarkers failed: {}", e.getMessage());
        }
        return results;
    }

    // -------------------------------------------------------------------------
    // Land claim regions
    // -------------------------------------------------------------------------

    public synchronized int insertRegion(String name, String world,
                                          int minX, int minZ, int maxX, int maxZ,
                                          String color, String owner, String type) {
        if (!connected) return -1;
        try (var ps = connection.prepareStatement(
                "INSERT INTO map_regions (name, world, min_x, min_z, max_x, max_z, color, owner, type) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, world);
            ps.setInt(3, minX);
            ps.setInt(4, minZ);
            ps.setInt(5, maxX);
            ps.setInt(6, maxZ);
            ps.setString(7, color != null ? color : "#3388ff");
            ps.setString(8, owner);
            ps.setString(9, type != null ? type : "claim");
            ps.executeUpdate();
            try (var keys = ps.getGeneratedKeys()) {
                return keys.next() ? keys.getInt(1) : -1;
            }
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] insertRegion failed: {}", e.getMessage());
            return -1;
        }
    }

    public synchronized void deleteRegion(int id) {
        if (!connected) return;
        try (var ps = connection.prepareStatement("DELETE FROM map_regions WHERE id = ?")) {
            ps.setInt(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] deleteRegion failed: {}", e.getMessage());
        }
    }

    public synchronized List<Map<String, Object>> getRegions(String world) {
        var results = new ArrayList<Map<String, Object>>();
        if (!connected) return results;

        var sql = world != null && !world.isEmpty()
                ? "SELECT id, name, world, min_x, min_z, max_x, max_z, color, owner, type " +
                  "FROM map_regions WHERE world = ? ORDER BY id"
                : "SELECT id, name, world, min_x, min_z, max_x, max_z, color, owner, type " +
                  "FROM map_regions ORDER BY id";

        try (var ps = connection.prepareStatement(sql)) {
            if (world != null && !world.isEmpty()) {
                ps.setString(1, world);
            }
            try (var rs = ps.executeQuery()) {
                while (rs.next()) {
                    var row = new HashMap<String, Object>();
                    row.put("id", rs.getInt("id"));
                    row.put("name", rs.getString("name"));
                    row.put("world", rs.getString("world"));
                    row.put("minX", rs.getInt("min_x"));
                    row.put("minZ", rs.getInt("min_z"));
                    row.put("maxX", rs.getInt("max_x"));
                    row.put("maxZ", rs.getInt("max_z"));
                    row.put("color", rs.getString("color"));
                    row.put("owner", rs.getString("owner"));
                    row.put("type", rs.getString("type"));
                    results.add(row);
                }
            }
        } catch (SQLException e) {
            LOGGER.warn("[NetherDeck-MapDB] getRegions failed: {}", e.getMessage());
        }
        return results;
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    public void close() {
        connected = false;
        var conn = connection;
        if (conn != null) {
            try {
                conn.close();
            } catch (SQLException e) {
                LOGGER.warn("[NetherDeck-MapDB] Error closing connection: {}", e.getMessage());
            }
            connection = null;
        }
    }

    public boolean isConnected() {
        return connected;
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    private static int parsePort(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return 3306;
        }
    }
}
