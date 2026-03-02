package io.github.netherdeck.fabric.mod.plugin.messaging;

import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckRawPayload;
import io.github.netherdeck.common.mod.plugin.messaging.PayloadDestroyer;
import net.fabricmc.fabric.api.networking.v1.ServerConfigurationNetworking;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public record NetherDeckFabricPayloadDestroyer(NetherDeckPluginChannel<NetherDeckFabricPayloadDestroyer> channel) implements FabricPayloadHandler, PayloadDestroyer {

    @Override
    public void receive(NetherDeckRawPayload payload, ServerPlayNetworking.Context context) {}

    @Override
    public void receive(NetherDeckRawPayload payload, ServerConfigurationNetworking.Context context) {}
}
