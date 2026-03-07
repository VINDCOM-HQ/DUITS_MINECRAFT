package io.github.netherdeck.common.netherdeck.mapextensions;

import io.github.netherdeck.common.netherdeck.NetherDeckConfig;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.PluginManager;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Records player movement as trail points sampled at a fixed interval.
 *
 * <p>Rather than capturing every {@link PlayerMoveEvent} (thousands per second),
 * this tracker stores the player's last seen position in-memory and flushes
 * it to MySQL on a configurable interval (default 5 seconds). This means
 * only one DB row per player per interval even if the player moves many blocks.
 *
 * <p>Old trail points beyond the retention window are pruned on each flush cycle.
 */
public final class PlayerTrailTracker implements Listener {

    private final MapDatabaseService db;
    private final int sampleIntervalSeconds;
    private final int retentionHours;

    /** uuid → last recorded position (world:x:y:z) */
    private final Map<UUID, LastPosition> lastPositions = new ConcurrentHashMap<>();

    private volatile ScheduledExecutorService flushExecutor;
    private volatile Object pluginRef;

    public PlayerTrailTracker(MapDatabaseService db, NetherDeckConfig config) {
        this.db = db;
        this.sampleIntervalSeconds = config.getTrailSampleInterval();
        this.retentionHours = config.getTrailRetentionHours();
    }

    /**
     * Registers the Bukkit event listener and starts the periodic flush task.
     *
     * @param server the Minecraft server (used to obtain the Bukkit plugin instance)
     */
    public void register(MinecraftServer server) {
        // Obtain the NetherDeck Bukkit plugin to register our listener
        var bukkitServer = getBukkitServer();
        if (bukkitServer == null) return;

        var ndPlugin = getNetherDeckPlugin(bukkitServer.getPluginManager());
        if (ndPlugin == null) return;

        pluginRef = ndPlugin;
        bukkitServer.getPluginManager().registerEvents(this, ndPlugin);

        flushExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            var t = new Thread(r, "NetherDeck-TrailFlush");
            t.setDaemon(true);
            return t;
        });

        flushExecutor.scheduleWithFixedDelay(
                this::flushToDatabase,
                sampleIntervalSeconds,
                sampleIntervalSeconds,
                TimeUnit.SECONDS
        );
    }

    public void unregister() {
        HandlerList.unregisterAll(this);

        var exec = flushExecutor;
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
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPlayerMove(PlayerMoveEvent event) {
        var from = event.getFrom();
        var to = event.getTo();
        // Ignore head-only rotations — only record when the player's block position changes
        if (to == null) return;
        if (from.getBlockX() == to.getBlockX()
                && from.getBlockY() == to.getBlockY()
                && from.getBlockZ() == to.getBlockZ()) {
            return;
        }

        var player = event.getPlayer();
        var loc = event.getTo();
        if (loc == null) return;

        lastPositions.put(
                player.getUniqueId(),
                new LastPosition(
                        player.getUniqueId().toString(),
                        loc.getWorld() != null ? loc.getWorld().getName() : "world",
                        loc.getX(), loc.getY(), loc.getZ()
                )
        );
    }

    private void flushToDatabase() {
        for (var pos : lastPositions.values()) {
            db.insertTrailPoint(pos.uuid(), pos.world(), pos.x(), pos.y(), pos.z());
        }
        lastPositions.clear();

        // Prune on every flush cycle
        db.pruneTrails(retentionHours);
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

    private static Plugin getNetherDeckPlugin(PluginManager pm) {
        // NetherDeck registers itself as a Bukkit plugin under this name
        var plugin = pm.getPlugin("NetherDeck");
        if (plugin == null) {
            // Fallback: pick the first enabled plugin (works in single-plugin setups)
            var plugins = pm.getPlugins();
            if (plugins.length > 0) {
                return plugins[0];
            }
        }
        return plugin;
    }

    // -------------------------------------------------------------------------
    // Inner types
    // -------------------------------------------------------------------------

    private record LastPosition(String uuid, String world, double x, double y, double z) {}
}
