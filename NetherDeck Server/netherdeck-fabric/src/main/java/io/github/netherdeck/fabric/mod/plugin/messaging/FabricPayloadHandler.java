package io.github.netherdeck.fabric.mod.plugin.messaging;

import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckRawPayload;
import io.github.netherdeck.common.mod.plugin.messaging.PluginChannelHandler;
import net.fabricmc.fabric.api.networking.v1.ServerConfigurationNetworking;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;

public interface FabricPayloadHandler extends PluginChannelHandler, ServerPlayNetworking.PlayPayloadHandler<NetherDeckRawPayload>, ServerConfigurationNetworking.ConfigurationPacketHandler<NetherDeckRawPayload> {}
