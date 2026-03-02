package io.github.netherdeck.fabric.mod.plugin.messaging;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.bridge.core.network.common.ServerCommonPacketListenerBridge;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckRawPayload;
import net.fabricmc.fabric.api.networking.v1.ServerConfigurationNetworking;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import org.bukkit.craftbukkit.v.entity.CraftPlayer;
import org.bukkit.plugin.Plugin;

public record NetherDeckFabricPayloadHandler(NetherDeckPluginChannel<NetherDeckFabricPayloadHandler> channel) implements FabricPayloadHandler {

    @Override
    public void updateChannel() {
    }

    @Override
    public void receive(NetherDeckRawPayload pkt, ServerPlayNetworking.Context ctx) {
        ctx.server().executeIfPossible(() -> {
            var bukkit = ((ServerPlayerEntityBridge)ctx.player()).bridge$getBukkitEntity();
            channel.dispatchMessage(bukkit, pkt.netherdeck$leak());
        });
    }

    @Override
    public void receive(NetherDeckRawPayload pkt, ServerConfigurationNetworking.Context ctx) {
        ctx.server().executeIfPossible(() -> {
            var bukkit = ((ServerCommonPacketListenerBridge)ctx.networkHandler()).bridge$getCraftPlayer();
            channel.dispatchMessage(bukkit, pkt.netherdeck$leak());
        });
    }

    @Override
    public void sendCustomPayload(Plugin src, CraftPlayer dst, byte[] data) {
        var player = dst.getHandle();
        if (player.connection != null) {
            ServerPlayNetworking.send(player, new NetherDeckRawPayload(channel.getType(), data));
        }
    }
}
