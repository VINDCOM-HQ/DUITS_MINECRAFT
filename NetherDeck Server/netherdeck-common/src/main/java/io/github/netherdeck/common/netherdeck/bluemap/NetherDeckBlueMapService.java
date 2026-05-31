package io.github.netherdeck.common.netherdeck.bluemap;

import io.github.netherdeck.common.netherdeck.NetherDeckConfig;
import io.github.netherdeck.common.netherdeck.mapextensions.DeathMarkerTracker;
import io.github.netherdeck.common.netherdeck.mapextensions.EntityHeatmapSampler;
import io.github.netherdeck.common.netherdeck.mapextensions.LandClaimManager;
import io.github.netherdeck.common.netherdeck.mapextensions.MapDatabaseService;
import io.github.netherdeck.common.netherdeck.mapextensions.PlayerTrailTracker;
import io.github.netherdeck.common.netherdeck.mapextensions.RespawnMarkerTracker;
import io.github.netherdeck.common.netherdeck.worldmap.NetherDeckMapServerAdapter;
import net.minecraft.server.MinecraftServer;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Lifecycle manager for the BlueMap-powered 3D world map.
 * Replaces the legacy {@code MapService} and custom PNG render pipeline.
 *
 * <p>Startup sequence (called from {@code MinecraftServerMixin_WorldMap} after
 * worlds are loaded):
 * <ol>
 *   <li>Build a {@link NetherDeckMapServerAdapter} wrapping all enabled levels</li>
 *   <li>Initialise {@link NetherDeckBlueMapPlugin} — starts BlueMap's incremental
 *       3D PRBM renderer</li>
 *   <li>Start {@link NetherDeckMapHttpHandler} — serves BlueMap tiles and
 *       extended-feature live endpoints</li>
 *   <li>Register Bukkit event listeners for player trails, deaths, and bed-respawns</li>
 *   <li>Start the entity heatmap sampler</li>
 * </ol>
 */
public final class NetherDeckBlueMapService {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-BlueMap");

    private static volatile NetherDeckBlueMapService instance;

    private final AtomicBoolean started = new AtomicBoolean(false);

    private volatile NetherDeckMapServerAdapter serverAdapter;
    private volatile NetherDeckBlueMapPlugin blueMapPlugin;
    private volatile NetherDeckMapHttpHandler httpHandler;
    private volatile MapDatabaseService databaseService;
    private volatile PlayerTrailTracker trailTracker;
    private volatile DeathMarkerTracker deathTracker;
    private volatile RespawnMarkerTracker respawnTracker;
    private volatile EntityHeatmapSampler heatmapSampler;

    private NetherDeckBlueMapService() {}

    // -------------------------------------------------------------------------
    // Static lifecycle API (called from mixin)
    // -------------------------------------------------------------------------

    public static void start(MinecraftServer server) {
        var ndConfig = NetherDeckConfig.getInstance();
        if (!ndConfig.isWorldMapEnabled()) {
            LOGGER.info("[NetherDeck-BlueMap] World map is disabled in netherdeck.yml");
            return;
        }

        var service = new NetherDeckBlueMapService();
        instance = service;

        try {
            service.doStart(server, ndConfig);
        } catch (Exception e) {
            LOGGER.error("[NetherDeck-BlueMap] Failed to start world map service", e);
            instance = null;
        }
    }

    public static void stop() {
        var service = instance;
        if (service != null) {
            service.doStop();
            instance = null;
        }
    }

    public static NetherDeckBlueMapService getInstance() {
        return instance;
    }

    // -------------------------------------------------------------------------
    // Instance lifecycle
    // -------------------------------------------------------------------------

    private void doStart(MinecraftServer server, NetherDeckConfig config) throws Exception {
        if (!started.compareAndSet(false, true)) {
            return;
        }

        LOGGER.info("[NetherDeck-BlueMap] Starting BlueMap-powered world map service...");

        // 1. Server adapter (provides world/player data to BlueMap)
        serverAdapter = new NetherDeckMapServerAdapter(server, config);
        LOGGER.info("[NetherDeck-BlueMap] Discovered {} worlds for rendering",
                serverAdapter.getWorldAdapters().size());
        serverAdapter.getWorldAdapters().values()
                .forEach(a -> LOGGER.info("[NetherDeck-BlueMap]   - {}", a.getId()));

        // 2. BlueMap core renderer
        blueMapPlugin = new NetherDeckBlueMapPlugin(serverAdapter);
        blueMapPlugin.load();

        // 3. Extended features database (optional — disabled gracefully if DB unavailable)
        databaseService = new MapDatabaseService();
        boolean dbAvailable = databaseService.connect();
        if (dbAvailable) {
            databaseService.ensureSchema();
            LOGGER.info("[NetherDeck-BlueMap] Map database connected");
        } else {
            LOGGER.warn("[NetherDeck-BlueMap] Map database unavailable — " +
                    "trails/markers/regions/heatmap persistence disabled");
        }

        // 4. HTTP handler (tiles + live endpoints)
        httpHandler = new NetherDeckMapHttpHandler(config, serverAdapter, databaseService);
        httpHandler.start();

        // 5. Extended feature trackers (only if DB is available)
        if (dbAvailable) {
            trailTracker = new PlayerTrailTracker(databaseService, config);
            trailTracker.register(server);

            deathTracker = new DeathMarkerTracker(databaseService);
            deathTracker.register(server);

            respawnTracker = new RespawnMarkerTracker(databaseService);
            respawnTracker.register(server);

            heatmapSampler = new EntityHeatmapSampler(serverAdapter, config);
            heatmapSampler.start();
        }

        LOGGER.info("[NetherDeck-BlueMap] World map service started successfully");
    }

    private void doStop() {
        if (!started.compareAndSet(true, false)) {
            return;
        }

        LOGGER.info("[NetherDeck-BlueMap] Stopping world map service...");

        if (heatmapSampler != null) {
            heatmapSampler.stop();
        }

        if (httpHandler != null) {
            httpHandler.stop();
        }

        if (blueMapPlugin != null) {
            blueMapPlugin.unload();
        }

        if (databaseService != null) {
            databaseService.close();
        }

        LOGGER.info("[NetherDeck-BlueMap] World map service stopped");
    }

    // -------------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------------

    public boolean isRunning() {
        return started.get();
    }

    public NetherDeckMapServerAdapter getServerAdapter() {
        return serverAdapter;
    }

    public EntityHeatmapSampler getHeatmapSampler() {
        return heatmapSampler;
    }

    public MapDatabaseService getDatabaseService() {
        return databaseService;
    }
}
