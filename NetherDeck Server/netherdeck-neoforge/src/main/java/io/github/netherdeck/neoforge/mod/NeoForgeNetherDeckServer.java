package io.github.netherdeck.neoforge.mod;

import io.github.netherdeck.api.NetherDeckPlatform;
import io.github.netherdeck.api.NetherDeckServer;
import io.github.netherdeck.api.TickingTracker;
import io.github.netherdeck.common.mod.server.api.DefaultTickingTracker;
import net.neoforged.bus.api.IEventBus;
import org.bukkit.plugin.Plugin;

public class NeoForgeNetherDeckServer implements NetherDeckServer {

    private final TickingTracker tickingTracker = new DefaultTickingTracker();

    @Override
    public void registerForgeEvent(Plugin plugin, net.minecraftforge.eventbus.api.IEventBus eventBus, Object target) {
        registerModEvent(plugin, eventBus, target);
    }

    @Override
    public void registerModEvent(Plugin plugin, Object bus, Object target) {
        try {
            if (bus instanceof IEventBus eventBus) {
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
