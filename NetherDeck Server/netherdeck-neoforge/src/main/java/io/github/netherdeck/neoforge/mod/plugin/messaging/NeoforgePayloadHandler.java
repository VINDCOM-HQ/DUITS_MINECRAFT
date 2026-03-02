package io.github.netherdeck.neoforge.mod.plugin.messaging;

import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckRawPayload;
import io.github.netherdeck.common.mod.plugin.messaging.PluginChannelHandler;
import net.neoforged.neoforge.network.handling.IPayloadHandler;

public interface NeoforgePayloadHandler extends PluginChannelHandler, IPayloadHandler<NetherDeckRawPayload> {}
