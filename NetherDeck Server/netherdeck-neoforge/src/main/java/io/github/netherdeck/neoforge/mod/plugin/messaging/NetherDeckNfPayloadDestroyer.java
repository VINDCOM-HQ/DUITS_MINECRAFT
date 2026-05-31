package io.github.netherdeck.neoforge.mod.plugin.messaging;

import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckRawPayload;
import io.github.netherdeck.common.mod.plugin.messaging.PayloadDestroyer;
import net.neoforged.neoforge.network.handling.IPayloadContext;

public record NetherDeckNfPayloadDestroyer(NetherDeckPluginChannel<NetherDeckNfPayloadDestroyer> channel) implements NeoforgePayloadHandler, PayloadDestroyer {
    @Override
    public void handle(NetherDeckRawPayload arg, IPayloadContext iPayloadContext) {}
}
