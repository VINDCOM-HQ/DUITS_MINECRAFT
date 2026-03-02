package io.github.netherdeck.common.bridge.bukkit;

import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.common.mod.plugin.messaging.PacketRecorder;
import it.unimi.dsi.fastutil.objects.Object2BooleanOpenHashMap;
import net.minecraft.resources.ResourceLocation;
import org.bukkit.craftbukkit.v.entity.CraftPlayer;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.messaging.PluginMessageListenerRegistration;

import java.util.Set;

public interface MessengerBridge {
    Object2BooleanOpenHashMap<String> valid = new Object2BooleanOpenHashMap<>();

    NetherDeckPluginChannel<?> netherdeck$setupChannel(ResourceLocation channel, Set<PluginMessageListenerRegistration> incoming, Set<Plugin> outgoing);

    void netherdeck$sendCustomPayload(Plugin src, CraftPlayer dst, ResourceLocation location, byte[] data);
    void netherdeck$registerAnonymousOutgoing(ResourceLocation location);
    NetherDeckPluginChannel<?> netherdeck$getAndCheckCrossSend(Plugin src, ResourceLocation channel);
    void netherdeck$checkUnsafeSend(Plugin src, ResourceLocation channel);

    PacketRecorder netherdeck$getPacketRecorder();
}
