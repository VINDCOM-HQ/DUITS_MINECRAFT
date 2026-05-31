package io.github.netherdeck.common.mixin.bukkit;

import com.google.common.collect.MultimapBuilder;
import com.google.common.collect.SetMultimap;
import io.github.netherdeck.common.bridge.bukkit.MessengerBridge;
import io.github.netherdeck.common.mod.plugin.messaging.PacketRecorder;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import net.minecraft.resources.ResourceLocation;
import org.bukkit.craftbukkit.v.entity.CraftPlayer;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.messaging.Messenger;
import org.bukkit.plugin.messaging.PluginMessageListenerRegistration;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.*;
import org.bukkit.plugin.messaging.StandardMessenger;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.*;

@Mixin(value = StandardMessenger.class, remap = false)
public abstract class StandardMessengerMixin implements Messenger, MessengerBridge {

    @Shadow @Final private Map<String, Set<Plugin>> outgoingByChannel;

    @Shadow @Final private Map<String, Set<PluginMessageListenerRegistration>> incomingByChannel;

    @Unique
    private Map<ResourceLocation, NetherDeckPluginChannel<?>> netherdeck$registry;

    @Unique
    private SetMultimap<Plugin, ResourceLocation> netherdeck$crossSend;

    @Unique
    private PacketRecorder netherdeck$recorder;

    @ModifyConstant(
            method = "validateAndCorrectChannel",
            constant = @Constant(intValue = Messenger.MAX_CHANNEL_SIZE)
    )
    private static int netherdeck$modifyMaxChannelSize(int original) {
        return 256;
    }

    @Override
    public NetherDeckPluginChannel<?> netherdeck$getAndCheckCrossSend(Plugin src, ResourceLocation channel) {
        var netherdeck = this.netherdeck$registry.get(channel);
        if (src == null) {
            NetherDeckServer.LOGGER.warn("Sending anonymous packet on channel {}", channel);
        } else if (!netherdeck.getOutgoing().contains(src)) {
            boolean first;
            synchronized (this.netherdeck$crossSend) {
                first = this.netherdeck$crossSend.put(src, channel);
            }
            if (first) {
                NetherDeckServer.LOGGER.warn("A plugin is sending message on a channel that's registered as outgoing by other plugins but itself!");
                NetherDeckServer.LOGGER.warn("Plugin: [{}], on channel: {}", src.getDescription().getFullName(), channel);
                NetherDeckServer.LOGGER.warn("This warning will only be displayed once for every plugin and channel.");
            }
        }
        return netherdeck;
    }

    @Override
    public void netherdeck$checkUnsafeSend(Plugin src, ResourceLocation channel) {
        var netherdeck = netherdeck$registry.get(channel);
        if (netherdeck != null && !netherdeck.getOutgoing().isEmpty()) {
            return;
        }
        var fullName = src == null ? "Unknown" : src.getDescription().getFullName();
        if (src == null) {
            netherdeck$registerAnonymousOutgoing(channel);
        } else {
            registerOutgoingPluginChannel(src, channel.toString());
        }
        NetherDeckServer.LOGGER.warn("Plugin [{}] is sending message on an unregistered outgoing channel {}, registering.", fullName, channel);
    }

    @Override
    public void netherdeck$sendCustomPayload(Plugin src, CraftPlayer dst, ResourceLocation location, byte[] data) {
        netherdeck$checkUnsafeSend(src, location);
        var channel = netherdeck$getAndCheckCrossSend(src, location);
        channel.sendCustomPayload(src, dst, data);
    }

    @Override
    public void netherdeck$registerAnonymousOutgoing(ResourceLocation location) {
        netherdeck$updateChannel(location, true);
    }

    @Override
    public PacketRecorder netherdeck$getPacketRecorder() {
        return netherdeck$recorder;
    }

    @Unique
    private void netherdeck$updateChannel(ResourceLocation location, boolean create) {
        if (location != null) {
            var id = location.toString();
            var channel = netherdeck$registry.computeIfAbsent(location, it -> {
                if (!create) {
                    return null;
                }
                var inByChannel = incomingByChannel.computeIfAbsent(id, k -> new HashSet<>());
                var outByChannel = outgoingByChannel.computeIfAbsent(id, k -> new HashSet<>());
                return netherdeck$setupChannel(location, inByChannel, outByChannel);
            });
            if (channel != null) {
                channel.getChannelHandler().updateChannel();
            }
        }
    }

    @Unique
    private void netherdeck$updateChannel(String location, boolean create) {
        netherdeck$updateChannel(ResourceLocation.tryParse(location), create);
    }

    @Inject(method = "<init>", at = @At("TAIL"))
    private void netherdeck$init(CallbackInfo ci) {
        netherdeck$registry = new HashMap<>();
        netherdeck$crossSend = MultimapBuilder.hashKeys().hashSetValues().build();
        netherdeck$recorder = new PacketRecorder();
    }

    @Redirect(method = {"removeFromOutgoing*", "removeFromIncoming*"}, at = @At(value = "INVOKE", target = "Ljava/util/Map;remove(Ljava/lang/Object;)Ljava/lang/Object;"))
    private Object netherdeck$skipRemove(Map<?, ?> thus, Object key) {
        return null;
    }

    @Inject(method = "addToOutgoing", at = @At("RETURN"))
    private void netherdeck$registerOut(Plugin plugin, String id, CallbackInfo ci) {
        netherdeck$updateChannel(id, true);
    }

    @Inject(method = "removeFromOutgoing(Lorg/bukkit/plugin/Plugin;Ljava/lang/String;)V", at = @At("RETURN"))
    private void netherdeck$unregisterOut(Plugin plugin, String id, CallbackInfo ci) {
        netherdeck$updateChannel(id, false);
    }

    @Inject(method = "addToIncoming", at = @At("RETURN"))
    private void netherdeck$registerIn(PluginMessageListenerRegistration registration, CallbackInfo ci) {
        netherdeck$updateChannel(registration.getChannel(), true);
    }

    @Inject(method = "removeFromIncoming(Lorg/bukkit/plugin/messaging/PluginMessageListenerRegistration;)V", at = @At("RETURN"))
    private void netherdeck$unregisterIn(PluginMessageListenerRegistration registration, CallbackInfo ci) {
        netherdeck$updateChannel(registration.getChannel(), false);
    }

    @Inject(method = "validateAndCorrectChannel", at = @At("TAIL"))
    private static void netherdeck$enhancedValidation(String channel, CallbackInfoReturnable<String> cir) {
        if (!valid.containsKey(channel)) {
            var corrected = cir.getReturnValue();
            var namespace = corrected.substring(0, corrected.indexOf(':'));
            var path = corrected.substring(corrected.indexOf(':') + 1);
            if (!ResourceLocation.isValidNamespace(namespace) || !ResourceLocation.isValidPath(path)) {
                NetherDeckServer.LOGGER.warn("Channel name is malformed and impossible to use: {}", corrected);
                NetherDeckServer.LOGGER.warn("Related functionality cannot be guaranteed!");
                NetherDeckServer.LOGGER.warn("This message will only be displayed once for this channel!");
                valid.put(channel, false);
            } else {
                valid.put(channel, true);
            }
        }
    }
}