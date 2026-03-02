package io.github.netherdeck.neoforge.mod.plugin.messaging;

import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.common.mod.plugin.messaging.ChannelDirection;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import io.github.netherdeck.neoforge.mixin.neoforge.NetworkRegistryAccessor;
import net.minecraft.network.protocol.PacketFlow;
import net.minecraft.resources.ResourceLocation;
import net.neoforged.neoforge.network.registration.PayloadRegistration;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.messaging.Messenger;
import org.bukkit.plugin.messaging.PluginMessageListenerRegistration;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * NETHERDECK_CUSTOM_CHANNEL_VERSION act as a mark for bypassing channel validation.
 * Use its identity to prevent any possibility of conflict.
 */
public class NetherDeckNfMessaging {
    @SuppressWarnings("StringOperationCanBeSimplified")
    public static String NETHERDECK_CUSTOM_CHANNEL_VERSION = new String("netherdeck:custom/bukkit");

    public static NetherDeckPluginChannel<? extends NeoforgePayloadHandler> setupChannel(Messenger messenger, ResourceLocation location, Set<PluginMessageListenerRegistration> incoming, Set<Plugin> outgoing) {
        if (verifyChannel(location, incoming, outgoing)) {
            return new NetherDeckPluginChannel<>(messenger, NetherDeckNfPayloadHandler::new, location, incoming, outgoing);
        } else {
            return new NetherDeckPluginChannel<>(messenger, NetherDeckNfPayloadDestroyer::new, location, incoming, outgoing);
        }
    }

    public static boolean verifyChannel(ResourceLocation location, Set<PluginMessageListenerRegistration> incoming, Set<Plugin> outgoing) {
        for (var protocol : NetherDeckPluginChannel.PROTOCOLS) {
            var known = NetworkRegistryAccessor.getRegistration().get(protocol).get(location);
            var builtin = NetworkRegistryAccessor.getBuiltinPayload().get(location);
            if (known != null || builtin != null) {
                var pluginList = Stream.concat(outgoing.stream(), incoming.stream().map(PluginMessageListenerRegistration::getPlugin))
                        .distinct()
                        .map(Plugin::getName)
                        .collect(Collectors.joining(", ", "[", "]"));
                NetherDeckServer.LOGGER.error("Attempting to register a channel that has already been registered by NeoForge!");
                NetherDeckServer.LOGGER.error("Channel conflict: {}, in protocol: {}", location, protocol);
                NetherDeckServer.LOGGER.error("Registered by plugin(s): {}", pluginList);
                if (known != null) {
                    NetherDeckServer.LOGGER.error("Registered by mod version: {}", known.version());
                }
                NetherDeckServer.LOGGER.error("This channel will be ignored for the rest of the time!");
                return false;
            }
        }
        return true;
    }

    public static void updateChannel(NetherDeckPluginChannel<NetherDeckNfPayloadHandler> channel) {
        final var location = channel.getChannel();
        for (var protocol : NetherDeckPluginChannel.PROTOCOLS) {
            var map = NetworkRegistryAccessor.getRegistration().get(protocol);
            if (channel.getDirection() != getFlowFromRegistration(map.get(location))) {
                final var registration = createRegistration(channel);
                if (registration == null) {
                    map.remove(location);
                } else {
                    map.put(location, registration);
                }
            }
        }
    }

    private static ChannelDirection getFlowFromRegistration(PayloadRegistration<?> registration) {
        if (registration == null) {
            return ChannelDirection.NONE;
        } else if (registration.flow().isEmpty()) {
            return ChannelDirection.BIDIRECTIONAL;
        } else {
            final var flow = registration.flow().get();
            if (flow == PacketFlow.SERVERBOUND) {
                return ChannelDirection.INCOMING;
            } else {
                return ChannelDirection.OUTGOING;
            }
        }
    }

    public static PayloadRegistration<?> createRegistration(NetherDeckPluginChannel<NetherDeckNfPayloadHandler> channel) {
        var direction = channel.getDirection();
        if (direction.bitmap == 0) {
            return null;
        }
        var handler = channel.getChannelHandler();
        var type = channel.getType();
        var codec = channel.getStreamCodec();
        var flow = channel.getDirection().flow;
        var version = NetherDeckNfMessaging.NETHERDECK_CUSTOM_CHANNEL_VERSION;

        return new PayloadRegistration<>(type, codec, handler, NetherDeckPluginChannel.PROTOCOLS, Optional.ofNullable(flow), version, true);
    }
}
