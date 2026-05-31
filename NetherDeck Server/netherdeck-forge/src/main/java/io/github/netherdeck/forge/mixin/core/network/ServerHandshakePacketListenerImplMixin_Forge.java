package io.github.netherdeck.forge.mixin.core.network;

import com.google.gson.Gson;
import com.mojang.authlib.properties.Property;
import io.github.netherdeck.common.mod.util.VelocitySupport;
import io.github.netherdeck.common.netherdeck.VanillaCompatibility;
import net.minecraft.network.Connection;
import net.minecraft.network.protocol.handshake.ClientIntentionPacket;
import net.minecraft.server.network.ServerHandshakePacketListenerImpl;
import net.minecraftforge.server.ServerLifecycleHooks;
import org.spigotmc.SpigotConfig;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

import java.util.Objects;

@Mixin(ServerHandshakePacketListenerImpl.class)
public abstract class ServerHandshakePacketListenerImplMixin_Forge {

    private static final String EXTRA_DATA = "extraData";
    private static final Gson GSON = new Gson();

    // Since forge is doing handleServerLogin we redirect it to add logic
    @Redirect(method = "handleIntention", at = @At(value = "INVOKE", target = "Lnet/minecraftforge/server/ServerLifecycleHooks;handleServerLogin(Lnet/minecraft/network/protocol/handshake/ClientIntentionPacket;Lnet/minecraft/network/Connection;)Z"))
    public boolean netherdeck$handleSpecialLogin(ClientIntentionPacket packet, Connection connection) {
        // Allow vanilla clients through when configured — check hostname directly
        // since the common mixin's bridge$setVanillaClient hasn't fired yet at this point
        if (VanillaCompatibility.isVanillaAllowed() && !packet.hostName().contains("\0FML")) {
            return true;
        }
        String ip = packet.hostName();
        if (!VelocitySupport.isEnabled() && SpigotConfig.bungee) {
            String[] split = ip.split("\0");
            if (split.length == 4) {
                Property[] properties = GSON.fromJson(split[3], Property[].class);
                for (Property property : properties) {
                    if (Objects.equals(property.name(), EXTRA_DATA)) {
                        String extraData = property.value().replace("\1", "\0");
                        // replace the hostname field with embedded data
                        //noinspection deprecation
                        var forgePacket = new ClientIntentionPacket(packet.protocolVersion(), extraData, packet.port(), packet.intention());
                        return ServerLifecycleHooks.handleServerLogin(forgePacket, connection);
                    }
                }
            }
        }
        return ServerLifecycleHooks.handleServerLogin(packet, connection);
    }
}
