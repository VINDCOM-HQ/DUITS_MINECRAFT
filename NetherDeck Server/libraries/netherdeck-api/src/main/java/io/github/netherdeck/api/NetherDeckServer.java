package io.github.netherdeck.api;

import net.minecraftforge.eventbus.api.IEventBus;
import org.bukkit.plugin.Plugin;

public interface NetherDeckServer {

    /**
     * @see NetherDeck#getVersion()
     */
    default NetherDeckVersion getVersion() {
        return NetherDeckVersion.current();
    }

    /**
     * @see NetherDeck#registerForgeEvent(Plugin, IEventBus, Object)
     * @deprecated Use {@link NetherDeckServer#registerModEvent(Plugin, Object, Object)} instead.
     */
    @Deprecated
    void registerForgeEvent(Plugin plugin, IEventBus eventBus, Object target);

    /**
     * @see NetherDeck#registerModEvent(Plugin, Object, Object)
     * @since 1.6.2
     */
    void registerModEvent(Plugin plugin, Object eventBus, Object target);

    /**
     * @return ticking tracker
     * @see NetherDeck#getTickingTracker()
     */
    TickingTracker getTickingTracker();
}
