package io.github.netherdeck.common.mod.server.world.border;

import io.github.netherdeck.common.bridge.core.world.border.WorldBorderBridge;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.*;
import net.minecraft.world.level.border.BorderChangeListener;
import net.minecraft.world.level.border.WorldBorder;

import java.util.function.Function;

public class NetherDeckBorderChangeListener implements BorderChangeListener {

    public static final NetherDeckBorderChangeListener INSTANCE = new NetherDeckBorderChangeListener();

    public static BorderChangeListener typed() {
        return INSTANCE;
    }

    @Override
    public void onBorderSizeSet(WorldBorder border, double d) {
        netherdeck$broadcastToDimension(border, ClientboundSetBorderSizePacket::new);
    }

    @Override
    public void onBorderSizeLerping(WorldBorder border, double d, double e, long l) {
        netherdeck$broadcastToDimension(border, ClientboundSetBorderLerpSizePacket::new);
    }

    @Override
    public void onBorderCenterSet(WorldBorder border, double d, double e) {
        netherdeck$broadcastToDimension(border, ClientboundSetBorderCenterPacket::new);
    }

    @Override
    public void onBorderSetWarningTime(WorldBorder border, int i) {
        netherdeck$broadcastToDimension(border, ClientboundSetBorderWarningDelayPacket::new);
    }

    @Override
    public void onBorderSetWarningBlocks(WorldBorder border, int i) {
        netherdeck$broadcastToDimension(border, ClientboundSetBorderWarningDistancePacket::new);
    }

    @Override
    public void onBorderSetDamagePerBlock(WorldBorder border, double d) {

    }

    @Override
    public void onBorderSetDamageSafeZOne(WorldBorder border, double d) {

    }

    private void netherdeck$broadcastToDimension(WorldBorder border, Function<WorldBorder, Packet<?>> packet) {
        final var level = ((WorldBorderBridge) border).bridge$getWorld();
        level.getServer().getPlayerList().broadcastAll(packet.apply(border), level.dimension());
    }
}
