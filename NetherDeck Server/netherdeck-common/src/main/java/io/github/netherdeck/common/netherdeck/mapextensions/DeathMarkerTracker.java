package io.github.netherdeck.common.netherdeck.mapextensions;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.PluginManager;

/**
 * Records skull markers on the map whenever a player dies.
 *
 * <p>Each death is written immediately to {@code map_death_markers} with the
 * player's UUID, display name, world, coordinates, and the death message
 * (which Bukkit provides as the "death cause" string).
 */
public final class DeathMarkerTracker implements Listener {

    private final MapDatabaseService db;

    public DeathMarkerTracker(MapDatabaseService db) {
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

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = false)
    public void onPlayerDeath(PlayerDeathEvent event) {
        var player = event.getEntity();
        var loc = player.getLocation();
        var world = loc.getWorld() != null ? loc.getWorld().getName() : "world";

        // Use the death message as the cause description; fall back to "Unknown"
        var cause = event.getDeathMessage();
        if (cause == null || cause.isBlank()) {
            cause = "Unknown";
        }

        db.insertDeathMarker(
                player.getUniqueId().toString(),
                player.getName(),
                world,
                loc.getX(),
                loc.getY(),
                loc.getZ(),
                cause
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
