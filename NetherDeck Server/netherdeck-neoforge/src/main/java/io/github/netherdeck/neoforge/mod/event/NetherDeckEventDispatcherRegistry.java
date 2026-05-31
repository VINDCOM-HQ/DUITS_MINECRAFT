package io.github.netherdeck.neoforge.mod.event;

import io.github.netherdeck.common.mod.server.NetherDeckServer;
import net.neoforged.neoforge.common.NeoForge;

public abstract class NetherDeckEventDispatcherRegistry {

    public static void registerAllEventDispatchers() {
        NeoForge.EVENT_BUS.register(new BlockBreakEventDispatcher());
        NeoForge.EVENT_BUS.register(new BlockPlaceEventDispatcher());
        NeoForge.EVENT_BUS.register(new EntityEventDispatcher());
        NeoForge.EVENT_BUS.register(new EntityTeleportEventDispatcher());
        NeoForge.EVENT_BUS.register(new ItemEntityEventDispatcher());
        NetherDeckServer.LOGGER.info("registry.forge-event");
    }
}
