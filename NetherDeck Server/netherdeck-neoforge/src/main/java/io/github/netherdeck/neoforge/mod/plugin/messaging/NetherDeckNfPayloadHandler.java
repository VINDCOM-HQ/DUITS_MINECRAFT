package io.github.netherdeck.neoforge.mod.plugin.messaging;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckRawPayload;
import net.neoforged.neoforge.network.PacketDistributor;
import net.neoforged.neoforge.network.handling.IPayloadContext;
import org.bukkit.craftbukkit.v.entity.CraftPlayer;
import org.bukkit.plugin.Plugin;

public record NetherDeckNfPayloadHandler(NetherDeckPluginChannel<NetherDeckNfPayloadHandler> channel) implements NeoforgePayloadHandler {
    @Override
    public void handle(NetherDeckRawPayload pkt, IPayloadContext ctx) {
        ctx.enqueueWork(() -> {
            var bukkit = ((ServerPlayerEntityBridge)ctx.player()).bridge$getBukkitEntity();
            channel.dispatchMessage(bukkit, pkt.netherdeck$leak());
        });
    }

    @Override
    public void updateChannel() {
        NetherDeckNfMessaging.updateChannel(channel);
    }

    @Override
    public void sendCustomPayload(Plugin src, CraftPlayer dst, byte[] data) {
        PacketDistributor.sendToPlayer(dst.getHandle(), new NetherDeckRawPayload(channel.getType(), data));
    }
}
