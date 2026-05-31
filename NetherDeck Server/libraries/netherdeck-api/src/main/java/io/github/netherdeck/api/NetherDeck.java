package io.github.netherdeck.api;

import net.minecraftforge.eventbus.api.IEventBus;
import org.bukkit.plugin.Plugin;

import java.util.Objects;

public class NetherDeck {

    private static NetherDeckServer server;

    /**
     * Version info for current NetherDeck
     */
    public static NetherDeckVersion getVersion() {
        return getServer().getVersion();
    }

    /**
     * @param target Either a {@link Class} instance or an arbitrary object
     * @see IEventBus#register(Object)
     * @deprecated Use {@link NetherDeck#registerModEvent(Plugin, Object, Object)} instead.
     */
    @Deprecated
    public static void registerForgeEvent(Plugin plugin, IEventBus eventBus, Object target) {
        getServer().registerForgeEvent(plugin, eventBus, target);
    }

    /**
     * Register a mod event handler.
     *
     * @param target Either a {@link Class} instance or an arbitrary object.
     * @since 1.6.2
     */
    public static void registerModEvent(Plugin plugin, Object eventBus, Object target) {
        getServer().registerModEvent(plugin, eventBus, target);
    }

    /**
     * Gets the {@link TickingTracker} instance.
     *
     * @return the ticking tracker
     * @since 1.4.0
     */
    public static TickingTracker getTickingTracker() {
        return getServer().getTickingTracker();
    }

    /**
     * Get current platform NetherDeck is running
     *
     * @return current platform
     * @since 1.6.0
     */
    public static NetherDeckPlatform getPlatform() {
        return NetherDeckPlatform.current();
    }

    private static NetherDeckServer getServer() {
        return Objects.requireNonNull(server, "Server not set!");
    }

    /**
     * Internal api for NetherDeck
     */
    public static void setServer(NetherDeckServer server) {
        Objects.requireNonNull(server, "server");
        if (NetherDeck.server != null) {
            throw new IllegalStateException("Server already set!");
        }
        NetherDeck.server = server;
    }
}
