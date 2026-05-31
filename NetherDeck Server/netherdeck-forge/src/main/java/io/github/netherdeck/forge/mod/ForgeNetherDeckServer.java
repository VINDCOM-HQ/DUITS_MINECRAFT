package io.github.netherdeck.forge.mod;

import io.github.netherdeck.api.NetherDeckPlatform;
import io.github.netherdeck.api.NetherDeckServer;
import io.github.netherdeck.api.TickingTracker;
import io.github.netherdeck.common.mod.server.api.DefaultTickingTracker;
import io.github.netherdeck.forge.mod.util.PluginEventHandler;
import net.minecraftforge.eventbus.EventBus;
import net.minecraftforge.eventbus.api.IEventBus;
import org.bukkit.plugin.Plugin;

public class ForgeNetherDeckServer implements NetherDeckServer {

    private final TickingTracker tickingTracker = new DefaultTickingTracker();

    @Override
    public void registerForgeEvent(Plugin plugin, IEventBus bus, Object target) {
        registerModEvent(plugin, bus, target);
    }

    @Override
    public void registerModEvent(Plugin plugin, Object bus, Object target) {
        try {
            if (bus instanceof EventBus eventBus) {
                PluginEventHandler.register(plugin, eventBus, target);
            } else if (bus instanceof IEventBus eventBus) {
                eventBus.register(target);
            } else {
                throw new IllegalArgumentException("Unknown bus type " + bus + " on platform " + NetherDeckPlatform.current());
            }
        } catch (Throwable t) {
            throw new RuntimeException(t);
        }
    }

    @Override
    public TickingTracker getTickingTracker() {
        return this.tickingTracker;
    }
}
