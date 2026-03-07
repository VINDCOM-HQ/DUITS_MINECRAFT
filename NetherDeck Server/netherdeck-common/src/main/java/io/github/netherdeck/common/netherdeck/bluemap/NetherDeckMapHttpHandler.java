package io.github.netherdeck.common.netherdeck.bluemap;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.github.netherdeck.common.netherdeck.NetherDeckConfig;
import io.github.netherdeck.common.netherdeck.mapextensions.MapDatabaseService;
import io.github.netherdeck.common.netherdeck.worldmap.NetherDeckMapServerAdapter;
import net.minecraft.server.level.ServerPlayer;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * Lightweight HTTP server that merges BlueMap tile serving with live
 * endpoints for players, trails, death markers, respawn markers, land
 * claim regions, and entity heatmap data.
 *
 * <p>All endpoints are bound to {@code localhost} only and proxied through
 * the SvelteKit web portal — they are never exposed to the internet directly.
 *
 * <h2>Tile layout (BlueMap output)</h2>
 * <pre>
 * GET /maps/{map}/tiles/{lod}/{x}_{z}.prbm     — 3D hi-res mesh tile
 * GET /maps/{map}/tiles/0/{x}_{z}.png          — low-res overview tile
 * GET /maps/{map}/live/players.json            — live player positions
 * </pre>
 *
 * <h2>Extended endpoints</h2>
 * <pre>
 * GET /live/players         — all online players with world/x/y/z
 * GET /live/trails          — recent player trail segments
 * GET /live/markers         — death + respawn markers
 * GET /live/regions         — land claim region list
 * GET /live/heatmap         — entity heatmap grid (sampled)
 * GET /metadata             — world list, spawn points
 * GET /health               — service health check
 * </pre>
 */
public final class NetherDeckMapHttpHandler {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-BlueMap");
    private static final Gson GSON = new GsonBuilder().create();

    /** BlueMap writes tiles here: netherdeck-map/bluemap/maps/<map>/tiles/... */
    private static final Path BLUEMAP_MAPS_DIR = Path.of(NetherDeckBlueMapPlugin.BLUEMAP_ROOT, "maps");

    private final NetherDeckConfig config;
    private final NetherDeckMapServerAdapter serverAdapter;
    private final MapDatabaseService db;
    private volatile HttpServer httpServer;

    public NetherDeckMapHttpHandler(NetherDeckConfig config,
                                     NetherDeckMapServerAdapter serverAdapter,
                                     MapDatabaseService db) {
        this.config = config;
        this.serverAdapter = serverAdapter;
        this.db = db;
    }

    public void start() throws IOException {
        var address = new InetSocketAddress(config.getWorldMapHttpBind(), config.getWorldMapHttpPort());
        httpServer = HttpServer.create(address, 0);
        httpServer.setExecutor(Executors.newFixedThreadPool(4, r -> {
            var t = new Thread(r, "NetherDeck-MapHTTP");
            t.setDaemon(true);
            return t;
        }));

        // BlueMap tile passthrough
        httpServer.createContext("/maps", this::handleMaps);

        // Legacy tile compatibility (existing SvelteKit proxy expects /tiles/...)
        httpServer.createContext("/tiles", this::handleTilesCompat);

        // Live & metadata endpoints
        httpServer.createContext("/live/players", this::handlePlayers);
        httpServer.createContext("/live/trails", this::handleTrails);
        httpServer.createContext("/live/markers", this::handleMarkers);
        httpServer.createContext("/live/regions", this::handleRegions);
        httpServer.createContext("/live/heatmap", this::handleHeatmap);
        httpServer.createContext("/metadata", this::handleMetadata);
        httpServer.createContext("/health", this::handleHealth);

        httpServer.start();
        LOGGER.info("[NetherDeck-BlueMap] HTTP server listening on {}:{}",
                config.getWorldMapHttpBind(), config.getWorldMapHttpPort());
    }

    public void stop() {
        var server = httpServer;
        if (server != null) {
            server.stop(2);
            LOGGER.info("[NetherDeck-BlueMap] HTTP server stopped");
        }
    }

    // -------------------------------------------------------------------------
    // Tile handlers
    // -------------------------------------------------------------------------

    /** Serves BlueMap-rendered tiles from {@code netherdeck-map/bluemap/maps/...} */
    private void handleMaps(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        var uriPath = exchange.getRequestURI().getPath();
        // Strip leading /maps
        var relativePath = uriPath.substring("/maps".length());
        if (relativePath.startsWith("/")) {
            relativePath = relativePath.substring(1);
        }

        var filePath = BLUEMAP_MAPS_DIR.resolve(relativePath);
        serveFile(exchange, filePath);
    }

    /**
     * Legacy compatibility: maps {@code /tiles/<world>/<z>/<x>_<z>.png} to
     * BlueMap's output structure. Supports both old PNG tiles (low-res overview)
     * and PRBM hi-res tiles.
     */
    private void handleTilesCompat(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        var uriPath = exchange.getRequestURI().getPath();
        var path = uriPath.substring("/tiles".length());
        if (path.startsWith("/")) {
            path = path.substring(1);
        }

        // Map /tiles/<world>/<lod>/<x>_<z>.ext → /maps/<world>/tiles/<lod>/<x>_<z>.ext
        var filePath = BLUEMAP_MAPS_DIR.resolve(path.replace("/", java.io.File.separator));
        if (!Files.exists(filePath)) {
            // Try BlueMap's actual tile path structure
            filePath = BLUEMAP_MAPS_DIR.resolve(path);
        }
        serveFile(exchange, filePath);
    }

    private void serveFile(HttpExchange exchange, Path filePath) throws IOException {
        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            sendJson(exchange, 404, Map.of("error", "Tile not found"));
            return;
        }

        var contentType = guessContentType(filePath.toString());
        var bytes = Files.readAllBytes(filePath);

        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Cache-Control", "public, max-age=60");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    // -------------------------------------------------------------------------
    // Live endpoints
    // -------------------------------------------------------------------------

    private void handlePlayers(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        var mcServer = serverAdapter.getMinecraftServer();
        var players = new ArrayList<Map<String, Object>>();

        if (mcServer.getPlayerList() != null) {
            for (ServerPlayer player : mcServer.getPlayerList().getPlayers()) {
                var pos = player.position();
                players.add(Map.of(
                        "name", player.getGameProfile().getName(),
                        "uuid", player.getUUID().toString(),
                        "world", player.level().dimension().location().toString(),
                        "x", pos.x,
                        "y", pos.y,
                        "z", pos.z
                ));
            }
        }

        sendJson(exchange, 200, Map.of("success", true, "players", players));
    }

    private void handleTrails(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        if (!db.isConnected()) {
            sendJson(exchange, 503, Map.of("error", "Database unavailable"));
            return;
        }

        var world = queryParam(exchange, "world");
        var uuid = queryParam(exchange, "uuid");
        var hours = parseIntParam(exchange, "hours", 24);

        var trails = db.getTrails(world, uuid, hours);
        sendJson(exchange, 200, Map.of("success", true, "trails", trails));
    }

    private void handleMarkers(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        if (!db.isConnected()) {
            sendJson(exchange, 503, Map.of("error", "Database unavailable"));
            return;
        }

        var world = queryParam(exchange, "world");
        var deaths = db.getDeathMarkers(world);
        var respawns = db.getRespawnMarkers(world);

        sendJson(exchange, 200, Map.of(
                "success", true,
                "deaths", deaths,
                "respawns", respawns
        ));
    }

    private void handleRegions(HttpExchange exchange) throws IOException {
        var method = exchange.getRequestMethod();

        if (!db.isConnected()) {
            sendJson(exchange, 503, Map.of("error", "Database unavailable"));
            return;
        }

        if ("GET".equals(method)) {
            var world = queryParam(exchange, "world");
            var regions = db.getRegions(world);
            sendJson(exchange, 200, Map.of("success", true, "regions", regions));
        } else if ("DELETE".equals(method)) {
            var id = parseIntParam(exchange, "id", -1);
            if (id < 0) {
                sendJson(exchange, 400, Map.of("error", "Missing region id"));
                return;
            }
            db.deleteRegion(id);
            sendJson(exchange, 200, Map.of("success", true));
        } else {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
        }
    }

    private void handleHeatmap(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        var service = NetherDeckBlueMapService.getInstance();
        if (service == null || service.getHeatmapSampler() == null) {
            sendJson(exchange, 503, Map.of("error", "Heatmap sampler not running"));
            return;
        }

        var world = queryParam(exchange, "world");
        var heatmap = service.getHeatmapSampler().getSnapshot(world);
        sendJson(exchange, 200, Map.of("success", true, "heatmap", heatmap));
    }

    private void handleMetadata(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        var worlds = new ArrayList<Map<String, Object>>();
        for (var entry : serverAdapter.getWorldAdapters().entrySet()) {
            var level = entry.getKey();
            var adapter = entry.getValue();
            var spawn = level.getSharedSpawnPos();

            worlds.add(Map.of(
                    "id", adapter.getId(),
                    "name", level.dimension().location().toString(),
                    "spawn", Map.of("x", spawn.getX(), "y", spawn.getY(), "z", spawn.getZ()),
                    "tileFormat", "prbm"
            ));
        }

        sendJson(exchange, 200, Map.of(
                "success", true,
                "worlds", worlds,
                "updateInterval", config.getWorldMapUpdateInterval(),
                "renderer", "bluemap-5.4"
        ));
    }

    private void handleHealth(HttpExchange exchange) throws IOException {
        sendJson(exchange, 200, Map.of(
                "success", true,
                "status", "ok",
                "db", db.isConnected()
        ));
    }

    // -------------------------------------------------------------------------
    // Utility
    // -------------------------------------------------------------------------

    private static void sendJson(HttpExchange exchange, int status, Object data) throws IOException {
        var json = GSON.toJson(data);
        var bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String guessContentType(String path) {
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".prbm")) return "application/octet-stream";
        if (path.endsWith(".gz")) return "application/gzip";
        return "application/octet-stream";
    }

    private static String queryParam(HttpExchange exchange, String name) {
        var query = exchange.getRequestURI().getQuery();
        if (query == null) return null;
        for (var part : query.split("&")) {
            var kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals(name)) {
                return kv[1];
            }
        }
        return null;
    }

    private static int parseIntParam(HttpExchange exchange, String name, int defaultValue) {
        var val = queryParam(exchange, name);
        if (val == null) return defaultValue;
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
