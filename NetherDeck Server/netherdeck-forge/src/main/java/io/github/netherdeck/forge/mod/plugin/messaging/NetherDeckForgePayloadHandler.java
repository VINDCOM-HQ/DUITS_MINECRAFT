package io.github.netherdeck.forge.mod.plugin.messaging;

import com.google.common.base.Preconditions;
import io.github.netherdeck.common.bridge.core.network.common.ServerCommonPacketListenerBridge;
import io.github.netherdeck.common.mod.NetherDeckConstants;
import io.github.netherdeck.common.mod.plugin.messaging.NetherDeckPluginChannel;
import io.netty.buffer.Unpooled;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraftforge.event.network.CustomPayloadEvent;
import net.minecraftforge.network.EventNetworkChannel;
import net.minecraftforge.network.PacketDistributor;
import org.bukkit.craftbukkit.v.entity.CraftPlayer;
import org.bukkit.plugin.Plugin;

public class NetherDeckForgePayloadHandler implements ForgePayloadHandler {

    private final NetherDeckPluginChannel<?> bukkit;
    private EventNetworkChannel forge;

    public NetherDeckForgePayloadHandler(NetherDeckPluginChannel<?> bukkit) {
        this.bukkit = bukkit;
    }

    public void initialize(EventNetworkChannel unconfigured) {
        forge = unconfigured.addListener(this);
    }

    @Override
    public void sendCustomPayload(Plugin src, CraftPlayer dst, byte[] data) {
        forge.send(new FriendlyByteBuf(Unpooled.wrappedBuffer(data)), PacketDistributor.PLAYER.with(dst.getHandle()));
    }

    @Override
    public NetherDeckPluginChannel<?> channel() {
        return bukkit;
    }

    @Override
    public void updateChannel() {

    }

    @Override
    public void accept(CustomPayloadEvent event) {
        var ctx = event.getSource();
        ctx.setPacketHandled(true);
        var buf = event.getPayload();
        final var max = NetherDeckConstants.MAX_C2S_CUSTOM_PAYLOAD_SIZE;
        Preconditions.checkArgument(buf.readableBytes() <= max, "Custom payload size may not be larger than " + max);

        byte[] data = new byte[buf.readableBytes()];
        buf.readBytes(data);

        ctx.enqueueWork(() -> {
            var listener = ctx.getConnection().getPacketListener();
            if (listener instanceof ServerCommonPacketListenerBridge bridge) {
                var craftbukkit = bridge.bridge$getCraftPlayer();
                bukkit.dispatchMessage(craftbukkit, data);
            }
        });
    }
}
