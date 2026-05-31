package io.github.netherdeck.fabric.mixin.bukkit;

import io.github.netherdeck.common.bridge.bukkit.MessengerBridge;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.fabric.mod.plugin.messaging.NetherDeckFabricMessaging;
import net.minecraft.resources.ResourceLocation;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.messaging.Messenger;
import org.bukkit.plugin.messaging.PluginMessageListenerRegistration;
import org.bukkit.plugin.messaging.StandardMessenger;
import org.spongepowered.asm.mixin.Mixin;

import java.util.Set;

@Mixin(value = StandardMessenger.class, remap = false)
public abstract class StandardMessengerMixin_Fabric implements Messenger, MessengerBridge {

    @Override
    public NetherDeckPluginChannel<?> netherdeck$setupChannel(ResourceLocation channel, Set<PluginMessageListenerRegistration> incoming, Set<Plugin> outgoing) {
        return NetherDeckFabricMessaging.setupChannel(this, channel, incoming, outgoing);
    }
}
