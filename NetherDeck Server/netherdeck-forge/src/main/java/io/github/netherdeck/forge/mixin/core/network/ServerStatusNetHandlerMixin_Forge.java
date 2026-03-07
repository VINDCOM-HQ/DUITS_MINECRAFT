package io.github.netherdeck.forge.mixin.core.network;

import io.github.netherdeck.common.bridge.core.network.ServerStatusPacketListenerBridge;
import io.github.netherdeck.common.netherdeck.VanillaCompatibility;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.status.ServerStatus;
import net.minecraft.server.network.ServerStatusPacketListenerImpl;
import net.minecraftforge.network.ServerStatusPing;
import org.spongepowered.asm.mixin.Mixin;

import java.util.Optional;

@Mixin(ServerStatusPacketListenerImpl.class)
public abstract class ServerStatusNetHandlerMixin_Forge implements ServerStatusPacketListenerBridge {
    @Override
    public ServerStatus bridge$platform$createServerStatus(Component description, Optional<ServerStatus.Players> players, Optional<ServerStatus.Version> version, Optional<ServerStatus.Favicon> favicon, boolean enforcesSecureChat) {
        Optional<ServerStatusPing> forgePing = VanillaCompatibility.isVanillaAllowed()
                ? Optional.empty()
                : Optional.of(new ServerStatusPing());
        return new ServerStatus(description, players, version, favicon, enforcesSecureChat, forgePing);
    }
}
