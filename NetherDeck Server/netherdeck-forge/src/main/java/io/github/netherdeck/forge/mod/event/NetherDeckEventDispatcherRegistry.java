package io.github.netherdeck.forge.mod.event;

import io.github.netherdeck.common.mod.server.NetherDeckServer;
import net.minecraftforge.common.MinecraftForge;

public abstract class NetherDeckEventDispatcherRegistry {

    public static void registerAllEventDispatchers() {
        MinecraftForge.EVENT_BUS.register(new BlockBreakEventDispatcher());
        MinecraftForge.EVENT_BUS.register(new BlockPlaceEventDispatcher());
        MinecraftForge.EVENT_BUS.register(new EntityEventDispatcher());
        MinecraftForge.EVENT_BUS.register(new EntityTeleportEventDispatcher());
        MinecraftForge.EVENT_BUS.register(new ItemEntityEventDispatcher());
        MinecraftForge.EVENT_BUS.register(new ChannelRegisterHandler());
        NetherDeckServer.LOGGER.info("registry.forge-event");
    }
}
