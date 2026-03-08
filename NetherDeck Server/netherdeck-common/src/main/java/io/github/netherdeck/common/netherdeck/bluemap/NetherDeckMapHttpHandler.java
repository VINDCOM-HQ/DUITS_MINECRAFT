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

    /**
     * BlueMap's web root — Three.js web app is extracted here by BlueMap on startup.
     * Default BlueMap webroot is "bluemap/web" (from webapp.conf).
     */
    private static final Path BLUEMAP_WEBROOT = Path.of("bluemap/web");

    /**
     * BlueMap writes rendered map tiles here: bluemap/web/maps/&lt;mapId&gt;/...
     * Default BlueMap file storage root is "bluemap/web/maps" (from storages/file.conf).
     */
    private static final Path BLUEMAP_MAPS_DIR = Path.of("bluemap/web/maps");

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

        // BlueMap tile passthrough (also intercepts live/players.json for dynamic serving)
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

        // Catch-all: serve BlueMap's Three.js web app static files from BLUEMAP_WEBROOT
        httpServer.createContext("/", this::handleWebApp);

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

    /**
     * Serves BlueMap map data from {@code bluemap/web/maps/...}.
     * Intercepts {@code /maps/<mapId>/live/players.json} to return live player positions
     * in BlueMap's expected format (since BlueMap's own webserver is disabled).
     */
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

        // Intercept live/players.json — BlueMap's Three.js app requests this for player markers
        if (relativePath.matches("[^/]+/live/players\\.json")) {
            handleBluemapLivePlayers(exchange);
            return;
        }

        var filePath = BLUEMAP_MAPS_DIR.resolve(relativePath);
        serveFile(exchange, filePath);
    }

    /** Returns player positions in BlueMap's {@code live/players.json} format. */
    private void handleBluemapLivePlayers(HttpExchange exchange) throws IOException {
        var mcServer = serverAdapter.getMinecraftServer();
        var playerList = new ArrayList<Map<String, Object>>();

        if (mcServer.getPlayerList() != null) {
            for (net.minecraft.server.level.ServerPlayer player : mcServer.getPlayerList().getPlayers()) {
                var pos = player.position();
                playerList.add(Map.of(
                        "playerName", player.getGameProfile().getName(),
                        "uuid", player.getUUID().toString(),
                        "foreign", false,
                        "position", Map.of("x", pos.x, "y", pos.y, "z", pos.z),
                        "rotation", Map.of("pitch", 0.0, "yaw", player.getYRot(), "roll", 0.0)
                ));
            }
        }

        sendJson(exchange, 200, Map.of(
                "timestamp", System.currentTimeMillis(),
                "players", playerList
        ));
    }

    /**
     * Serves BlueMap's Three.js web application static files from {@code bluemap/web/}.
     * Acts as a catch-all for any path not matched by more specific handlers.
     */
    private void handleWebApp(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        var uriPath = exchange.getRequestURI().getPath();
        var relative = uriPath.startsWith("/") ? uriPath.substring(1) : uriPath;

        // Root or bare directory → serve index.html
        if (relative.isEmpty() || relative.endsWith("/")) {
            relative = relative + "index.html";
        }

        var filePath = BLUEMAP_WEBROOT.resolve(relative).normalize();

        // Prevent path traversal
        if (!filePath.startsWith(BLUEMAP_WEBROOT.normalize())) {
            sendJson(exchange, 403, Map.of("error", "Forbidden"));
            return;
        }

        // If BlueMap hasn't extracted its web app yet, return a friendly placeholder
        if (!Files.exists(BLUEMAP_WEBROOT)) {
            var html = "<html><body style='font-family:monospace;padding:2em;background:#1a1625;color:#c4b5fd'>" +
                    "<h2>BlueMap is initialising...</h2>" +
                    "<p>The 3D world map is loading for the first time. " +
                    "BlueMap is downloading Minecraft resources and rendering the map. " +
                    "This may take a few minutes. Please refresh the page shortly.</p>" +
                    "</body></html>";
            var bytes = html.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            exchange.sendResponseHeaders(200, bytes.length);
            try (var os = exchange.getResponseBody()) {
                os.write(bytes);
            }
            return;
        }

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
        // BlueMap compresses tiles with gzip — try the .gz variant if the bare file doesn't exist
        boolean gzipped = false;
        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            var gzPath = filePath.resolveSibling(filePath.getFileName() + ".gz");
            if (Files.exists(gzPath) && Files.isRegularFile(gzPath)) {
                filePath = gzPath;
                gzipped = true;
            } else {
                sendJson(exchange, 404, Map.of("error", "Tile not found"));
                return;
            }
        }

        // If the file itself has a .gz extension it's a pre-compressed asset
        var fileName = filePath.getFileName().toString();
        if (fileName.endsWith(".gz") && !gzipped) {
            gzipped = true;
        }

        // Content-Type is the type of the underlying (uncompressed) resource
        var typePath = gzipped ? filePath.resolveSibling(fileName.replaceAll("\\.gz$", "")).toString()
                                : filePath.toString();
        var contentType = guessContentType(typePath);
        var bytes = Files.readAllBytes(filePath);

        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Cache-Control", "public, max-age=60");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        if (gzipped) {
            exchange.getResponseHeaders().set("Content-Encoding", "gzip");
        }
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
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".html")) return "text/html; charset=utf-8";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
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
