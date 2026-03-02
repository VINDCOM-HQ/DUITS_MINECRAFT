package io.github.netherdeck.common.netherdeck.worldmap;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import net.minecraft.server.level.ServerPlayer;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.Executors;

/**
 * Lightweight HTTP server bound to localhost serving tile data, metadata,
 * and player positions. The SvelteKit portal proxies requests through
 * this server — it is never exposed to the internet directly.
 */
public final class MapHttpServer {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-Map");
    private static final Gson GSON = new GsonBuilder().create();

    private final MapConfig config;
    private final MapTileStorage storage;
    private final NetherDeckMapServerAdapter serverAdapter;
    private volatile HttpServer httpServer;

    public MapHttpServer(MapConfig config, MapTileStorage storage, NetherDeckMapServerAdapter serverAdapter) {
        this.config = config;
        this.storage = storage;
        this.serverAdapter = serverAdapter;
    }

    public void start() throws IOException {
        var address = new InetSocketAddress(config.httpBind(), config.httpPort());
        httpServer = HttpServer.create(address, 0);
        httpServer.setExecutor(Executors.newFixedThreadPool(2, r -> {
            var t = new Thread(r, "NetherDeck-MapHTTP");
            t.setDaemon(true);
            return t;
        }));

        httpServer.createContext("/tiles", this::handleTiles);
        httpServer.createContext("/metadata", this::handleMetadata);
        httpServer.createContext("/players", this::handlePlayers);
        httpServer.createContext("/health", this::handleHealth);

        httpServer.start();
        LOGGER.info("[NetherDeck-Map] HTTP server listening on {}:{}", config.httpBind(), config.httpPort());
    }

    public void stop() {
        var server = httpServer;
        if (server != null) {
            server.stop(2);
            LOGGER.info("[NetherDeck-Map] HTTP server stopped");
        }
    }

    private void handleTiles(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendJson(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        var path = exchange.getRequestURI().getPath().substring("/tiles".length());
        if (path.startsWith("/")) {
            path = path.substring(1);
        }

        var tilePath = storage.getBaseDir().resolve("tiles").resolve(path);
        if (!Files.exists(tilePath) || !Files.isRegularFile(tilePath)) {
            sendJson(exchange, 404, Map.of("error", "Tile not found"));
            return;
        }

        var contentType = guessContentType(tilePath.toString());
        var bytes = Files.readAllBytes(tilePath);

        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Cache-Control", "public, max-age=60");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
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
                    "renderDistance", config.renderDistance()
            ));
        }

        sendJson(exchange, 200, Map.of(
                "success", true,
                "worlds", worlds,
                "renderDistance", config.renderDistance(),
                "updateInterval", config.updateInterval()
        ));
    }

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

    private void handleHealth(HttpExchange exchange) throws IOException {
        sendJson(exchange, 200, Map.of("success", true, "status", "ok"));
    }

    private static void sendJson(HttpExchange exchange, int status, Object data) throws IOException {
        var json = GSON.toJson(data);
        var bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String guessContentType(String path) {
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".prbm")) return "application/octet-stream";
        return "application/octet-stream";
    }
}
