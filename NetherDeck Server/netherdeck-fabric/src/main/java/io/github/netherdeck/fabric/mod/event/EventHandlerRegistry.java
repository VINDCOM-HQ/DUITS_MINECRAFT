package io.github.netherdeck.fabric.mod.event;

import io.github.netherdeck.common.mod.server.event.EntityEventHandler;

public class EventHandlerRegistry {
    public static void register() {
        LivingDropsEvent.EVENT.register(EntityEventHandler::monitorLivingDrops);
        S2CPlayNConfigChannelHandler.register();
    }
}
