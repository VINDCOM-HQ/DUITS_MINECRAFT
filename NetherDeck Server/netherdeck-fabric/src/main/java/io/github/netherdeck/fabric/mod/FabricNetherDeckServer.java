package io.github.netherdeck.fabric.mod;

import io.github.netherdeck.api.NetherDeckServer;
import io.github.netherdeck.api.TickingTracker;
import io.github.netherdeck.common.mod.server.api.DefaultTickingTracker;
import org.bukkit.plugin.Plugin;

public class FabricNetherDeckServer implements NetherDeckServer {

    private final TickingTracker tickingTracker = new DefaultTickingTracker();

    @Override
    public void registerForgeEvent(Plugin plugin, net.minecraftforge.eventbus.api.IEventBus eventBus, Object target) {
        registerModEvent(plugin, eventBus, target);
    }

    @Override
    public void registerModEvent(Plugin plugin, Object bus, Object target) {
        throw new UnsupportedOperationException("Not supported on Fabric");
    }

    @Override
    public TickingTracker getTickingTracker() {
        return this.tickingTracker;
    }
}
