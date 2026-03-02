package io.github.netherdeck.forge.mod.plugin.messaging;

import io.github.netherdeck.common.mod.plugin.messaging.PluginChannelHandler;
import net.minecraftforge.event.network.CustomPayloadEvent;

import java.util.function.Consumer;

public interface ForgePayloadHandler extends PluginChannelHandler, Consumer<CustomPayloadEvent> {}
