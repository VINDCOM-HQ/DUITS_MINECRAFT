package io.github.netherdeck.common.netherdeck.mapextensions;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerBedEnterEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.PluginManager;

/**
 * Tracks bed / anchor respawn point changes and records them in
 * {@code map_respawn_points} so the web portal can display a bed icon
 * for each player's last known sleep location.
 *
 * <p>Two events update this record:
 * <ul>
 *   <li>{@link PlayerBedEnterEvent} — player successfully sleeps in a bed</li>
 *   <li>{@link PlayerRespawnEvent} — player respawns at their anchor/bed
 *       (confirms the set point is active)</li>
 * </ul>
 */
public final class RespawnMarkerTracker implements Listener {

    private final MapDatabaseService db;

    public RespawnMarkerTracker(MapDatabaseService db) {
        this.db = db;
    }

    public void register(Object mcServer) {
        var bukkitServer = getBukkitServer();
        if (bukkitServer == null) return;

        var ndPlugin = getNetherDeckPlugin(bukkitServer.getPluginManager());
        if (ndPlugin == null) return;

        bukkitServer.getPluginManager().registerEvents(this, ndPlugin);
    }

    public void unregister() {
        HandlerList.unregisterAll(this);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onBedEnter(PlayerBedEnterEvent event) {
        if (event.getBedEnterResult() != PlayerBedEnterEvent.BedEnterResult.OK) {
            return;
        }

        var player = event.getPlayer();
        var loc = event.getBed().getLocation();
        var world = loc.getWorld() != null ? loc.getWorld().getName() : "world";

        db.upsertRespawnMarker(
                player.getUniqueId().toString(),
                player.getName(),
                world,
                loc.getX(),
                loc.getY(),
                loc.getZ()
        );
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onRespawn(PlayerRespawnEvent event) {
        if (!event.isBedSpawn() && !event.isAnchorSpawn()) {
            return;
        }

        var player = event.getPlayer();
        var loc = event.getRespawnLocation();
        var world = loc.getWorld() != null ? loc.getWorld().getName() : "world";

        db.upsertRespawnMarker(
                player.getUniqueId().toString(),
                player.getName(),
                world,
                loc.getX(),
                loc.getY(),
                loc.getZ()
        );
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
        var plugin = pm.getPlugin("NetherDeck");
        if (plugin == null) {
            var plugins = pm.getPlugins();
            if (plugins.length > 0) {
                return plugins[0];
            }
        }
        return plugin;
    }
}
