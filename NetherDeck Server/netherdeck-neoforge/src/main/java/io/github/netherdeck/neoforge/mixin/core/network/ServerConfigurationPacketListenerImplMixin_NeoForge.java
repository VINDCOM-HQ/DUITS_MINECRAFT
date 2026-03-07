package io.github.netherdeck.neoforge.mixin.core.network;

import io.github.netherdeck.common.mod.server.NetherDeckServer;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.common.netherdeck.VanillaCompatibility;
import io.github.netherdeck.neoforge.mod.network.VanillaConnectionContext;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.ServerLinks;
import net.minecraft.server.network.ServerConfigurationPacketListenerImpl;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.v.CraftServerLinks;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerLinksSendEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(ServerConfigurationPacketListenerImpl.class)
public abstract class ServerConfigurationPacketListenerImplMixin_NeoForge extends ServerCommonPacketListenerImplMixin_NeoForge {

    // @formatter:off
    @Shadow protected abstract void runConfiguration();
    // connection field inherited from ServerCommonPacketListenerImplMixin_NeoForge
    // @formatter:on

    @Decorate(method = "runConfiguration", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/MinecraftServer;serverLinks()Lnet/minecraft/server/ServerLinks;"))
    private ServerLinks netherdeck$sendLinksEvent(MinecraftServer instance) throws Throwable {
        var links = (ServerLinks) DecorationOps.callsite().invoke(instance);
        var wrapper = new CraftServerLinks(links);
        var event = new PlayerLinksSendEvent((Player) bridge$getPlayer().bridge$getBukkitEntity(), wrapper);
        Bukkit.getPluginManager().callEvent(event);
        return wrapper.getServerLinks();
    }

    @Redirect(method = "handlePong", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/network/ServerConfigurationPacketListenerImpl;runConfiguration()V"))
    private void netherdeck$runConfigurationMainThread(ServerConfigurationPacketListenerImpl instance) {
        // Capture vanilla status on the Netty I/O thread, then propagate to the main
        // thread via the ThreadLocal so NeoForge negotiation mixins can read it.
        boolean vanilla = VanillaCompatibility.shouldBypass(this.connection);
        NetherDeckServer.executeOnMainThread(() -> {
            VanillaConnectionContext.set(vanilla);
            try {
                this.runConfiguration();
            } finally {
                VanillaConnectionContext.clear();
            }
        });
    }
}
