package io.github.netherdeck.forge.mod.plugin.messaging;

import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckRawPayload;
import io.github.netherdeck.common.mod.plugin.messaging.PayloadDestroyer;
import net.minecraftforge.event.network.CustomPayloadEvent;

public record NetherDeckForgePayloadDestroyer(NetherDeckPluginChannel<NetherDeckForgePayloadDestroyer> channel) implements ForgePayloadHandler, PayloadDestroyer {

    @Override
    public void accept(CustomPayloadEvent customPayloadEvent) {}
}
