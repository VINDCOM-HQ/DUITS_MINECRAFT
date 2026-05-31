package io.github.netherdeck.common.netherdeck.mapextensions;

import io.github.netherdeck.common.netherdeck.NetherDeckConfig;
import io.github.netherdeck.common.netherdeck.worldmap.NetherDeckMapServerAdapter;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Periodically samples entity counts per 16×16 chunk across all loaded chunks
 * and maintains a rolling average over the last 3 samples for display in the
 * web portal's real-time entity heatmap overlay.
 *
 * <p>Sampling runs on a single daemon thread. Block-data collection is submitted
 * to the server main thread via Bukkit's scheduler to maintain thread safety.
 * The averaged snapshot is held in an {@link AtomicReference} and is served
 * on-demand through the HTTP handler.
 */
public final class EntityHeatmapSampler {

    private static final Logger LOGGER = LogManager.getLogger("NetherDeck-Heatmap");

    /** Number of past samples included in the rolling average. */
    private static final int ROLLING_WINDOW = 3;

    private final NetherDeckMapServerAdapter serverAdapter;
    private final int sampleIntervalSeconds;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile ScheduledExecutorService executor;

    /** Per-world rolling sample ring buffer: worldId → list of samples (newest last). */
    private final ConcurrentHashMap<String, List<List<Map<String, Object>>>> ringSamples =
            new ConcurrentHashMap<>();

    /** Per-world latest averaged snapshot (ready to serve). */
    private final ConcurrentHashMap<String, List<Map<String, Object>>> snapshots =
            new ConcurrentHashMap<>();

    public EntityHeatmapSampler(NetherDeckMapServerAdapter serverAdapter, NetherDeckConfig config) {
        this.serverAdapter = serverAdapter;
        this.sampleIntervalSeconds = config.getHeatmapSampleInterval();
    }

    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }

        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            var t = new Thread(r, "NetherDeck-HeatmapSampler");
            t.setDaemon(true);
            return t;
        });

        executor.scheduleWithFixedDelay(
                this::sample,
                sampleIntervalSeconds,
                sampleIntervalSeconds,
                TimeUnit.SECONDS
        );

        LOGGER.info("[NetherDeck-Heatmap] Entity heatmap sampler started ({}s interval)",
                sampleIntervalSeconds);
    }

    public void stop() {
        if (!running.compareAndSet(true, false)) {
            return;
        }
        var exec = executor;
        if (exec != null) {
            exec.shutdown();
            try {
                if (!exec.awaitTermination(5, TimeUnit.SECONDS)) {
                    exec.shutdownNow();
                }
            } catch (InterruptedException e) {
                exec.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
        LOGGER.info("[NetherDeck-Heatmap] Entity heatmap sampler stopped");
    }

    /**
     * Returns the latest averaged heatmap snapshot for a world.
     *
     * @param worldId the world identifier, or {@code null} for the overworld
     * @return list of chunk entries: [{cx, cz, count}, ...]
     */
    public List<Map<String, Object>> getSnapshot(String worldId) {
        if (worldId == null || worldId.isBlank()) {
            worldId = "minecraft_overworld";
        }
        return snapshots.getOrDefault(worldId, List.of());
    }

    // -------------------------------------------------------------------------
    // Sampling pipeline
    // -------------------------------------------------------------------------

    private void sample() {
        try {
            var bukkitServer = getBukkitServer();
            if (bukkitServer == null) return;

            for (var entry : serverAdapter.getWorldAdapters().entrySet()) {
                var adapter = entry.getValue();
                var worldId = adapter.getId();

                // Collect entity counts per chunk on the main thread
                var future = new CompletableFuture<List<Map<String, Object>>>();
                bukkitServer.getScheduler().runTask(
                        getPlugin(bukkitServer.getPluginManager()),
                        () -> {
                            try {
                                var mcLevel = entry.getKey();
                                var chunks = new ArrayList<Map<String, Object>>();

                                // Bukkit world matching by dimension key
                                var dimensionKey = mcLevel.dimension().location().toString();
                                for (var bWorld : bukkitServer.getWorlds()) {
                                    if (!matchesDimension(bWorld.getName(), dimensionKey)) {
                                        continue;
                                    }
                                    for (var chunk : bWorld.getLoadedChunks()) {
                                        int count = chunk.getEntities().length;
                                        if (count > 0) {
                                            chunks.add(Map.of(
                                                    "cx", chunk.getX(),
                                                    "cz", chunk.getZ(),
                                                    "count", count
                                            ));
                                        }
                                    }
                                }
                                future.complete(chunks);
                            } catch (Exception e) {
                                future.completeExceptionally(e);
                            }
                        }
                );

                try {
                    var sample = future.get(10, TimeUnit.SECONDS);
                    addToRingBuffer(worldId, sample);
                    snapshots.put(worldId, computeAverage(worldId));
                } catch (TimeoutException e) {
                    LOGGER.warn("[NetherDeck-Heatmap] Sampling timed out for {}", worldId);
                } catch (Exception e) {
                    LOGGER.warn("[NetherDeck-Heatmap] Sampling failed for {}: {}", worldId, e.getMessage());
                }
            }
        } catch (Exception e) {
            LOGGER.error("[NetherDeck-Heatmap] Unexpected error during sampling", e);
        }
    }

    private void addToRingBuffer(String worldId, List<Map<String, Object>> sample) {
        ringSamples.compute(worldId, (k, existing) -> {
            var ring = existing != null ? existing : new ArrayList<List<Map<String, Object>>>();
            ring.add(sample);
            if (ring.size() > ROLLING_WINDOW) {
                ring.removeFirst();
            }
            return ring;
        });
    }

    private List<Map<String, Object>> computeAverage(String worldId) {
        var ring = ringSamples.get(worldId);
        if (ring == null || ring.isEmpty()) return List.of();

        // Aggregate chunk counts from all samples in the ring
        var totals = new ConcurrentHashMap<String, long[]>(); // key="cx,cz" → [totalCount, sampleCount]

        for (var sample : ring) {
            for (var chunk : sample) {
                var key = chunk.get("cx") + "," + chunk.get("cz");
                var acc = totals.computeIfAbsent(key, k -> new long[]{0, 0});
                acc[0] += ((Number) chunk.get("count")).longValue();
                acc[1]++;
            }
        }

        var result = new ArrayList<Map<String, Object>>(totals.size());
        for (var e : totals.entrySet()) {
            var parts = e.getKey().split(",");
            var avgCount = (double) e.getValue()[0] / e.getValue()[1];
            result.add(Map.of(
                    "cx", Integer.parseInt(parts[0]),
                    "cz", Integer.parseInt(parts[1]),
                    "count", avgCount
            ));
        }
        return result;
    }

    private static boolean matchesDimension(String worldName, String dimensionKey) {
        // minecraft:overworld → "world", minecraft:the_nether → "world_nether", etc.
        if ("minecraft:overworld".equals(dimensionKey)) {
            return "world".equals(worldName);
        }
        if ("minecraft:the_nether".equals(dimensionKey)) {
            return worldName.endsWith("_nether");
        }
        if ("minecraft:the_end".equals(dimensionKey)) {
            return worldName.endsWith("_the_end");
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Bukkit interop helpers
    // -------------------------------------------------------------------------

    private static org.bukkit.Server getBukkitServer() {
        try {
            return org.bukkit.Bukkit.getServer();
        } catch (Exception e) {
            return null;
        }
    }

    private static org.bukkit.plugin.Plugin getPlugin(org.bukkit.plugin.PluginManager pm) {
        var plugin = pm.getPlugin("NetherDeck");
        if (plugin == null) {
            var plugins = pm.getPlugins();
            if (plugins.length > 0) return plugins[0];
        }
        return plugin;
    }
}
