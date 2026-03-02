package io.github.netherdeck.common.netherdeck.worldmap;

import io.github.netherdeck.common.netherdeck.NetherDeckConfig;
import net.minecraft.server.MinecraftServer;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Lifecycle manager for the built-in 3D world map.
 * Creates map instances, starts the render scheduler and HTTP server.
 * Called from the worldmap mixin during server start/stop.
 */
public final class MapService {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-Map");

    private static volatile MapService instance;

    private final MapConfig config;
    private final MapTileStorage storage;
    private final MapRenderScheduler renderScheduler;
    private final AtomicBoolean started = new AtomicBoolean(false);

    private volatile NetherDeckMapServerAdapter serverAdapter;
    private volatile MapHttpServer httpServer;

    private MapService(MapConfig config) {
        this.config = config;
        this.storage = new MapTileStorage(Path.of("."));
        this.renderScheduler = new MapRenderScheduler(config);
    }

    /**
     * Called from the MinecraftServer mixin after worlds are loaded.
     */
    public static void start(MinecraftServer server) {
        var ndConfig = NetherDeckConfig.getInstance();
        if (!ndConfig.isWorldMapEnabled()) {
            LOGGER.info("[NetherDeck-Map] World map is disabled in netherdeck.yml");
            return;
        }

        var mapConfig = MapConfig.fromConfig(ndConfig);
        var service = new MapService(mapConfig);
        instance = service;

        try {
            service.doStart(server);
        } catch (Exception e) {
            LOGGER.error("[NetherDeck-Map] Failed to start world map service", e);
            instance = null;
        }
    }

    /**
     * Called from the MinecraftServer mixin during server shutdown.
     */
    public static void stop() {
        var service = instance;
        if (service != null) {
            service.doStop();
            instance = null;
        }
    }

    public static MapService getInstance() {
        return instance;
    }

    private void doStart(MinecraftServer server) throws Exception {
        if (!started.compareAndSet(false, true)) {
            return;
        }

        LOGGER.info("[NetherDeck-Map] Starting world map service...");

        storage.ensureBaseDir();

        serverAdapter = new NetherDeckMapServerAdapter(server, config);

        LOGGER.info("[NetherDeck-Map] Discovered {} worlds for rendering",
                serverAdapter.getWorldAdapters().size());

        for (var adapter : serverAdapter.getWorldAdapters().values()) {
            storage.ensureDirectories(adapter.getId());
            LOGGER.info("[NetherDeck-Map]   - {}", adapter.getId());
        }

        httpServer = new MapHttpServer(config, storage, serverAdapter);
        httpServer.start();

        renderScheduler.start();

        LOGGER.info("[NetherDeck-Map] World map service started successfully");
    }

    private void doStop() {
        if (!started.compareAndSet(true, false)) {
            return;
        }

        LOGGER.info("[NetherDeck-Map] Stopping world map service...");

        renderScheduler.stop();

        if (httpServer != null) {
            httpServer.stop();
        }

        LOGGER.info("[NetherDeck-Map] World map service stopped");
    }

    public MapConfig getConfig() {
        return config;
    }

    public MapTileStorage getStorage() {
        return storage;
    }

    public NetherDeckMapServerAdapter getServerAdapter() {
        return serverAdapter;
    }

    public boolean isRunning() {
        return started.get();
    }
}
