package io.github.netherdeck.common.mod.plugin.messaging;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class NetherDeckRawPayload implements RawPayload {

    public static final Map<ResourceLocation, CustomPacketPayload.Type<NetherDeckRawPayload>> REGISTRY = new HashMap<>();

    public static CustomPacketPayload.Type<NetherDeckRawPayload> getType(ResourceLocation channel) {
        return REGISTRY.computeIfAbsent(channel, CustomPacketPayload.Type::new);
    }

    private final Type<NetherDeckRawPayload> type;
    private ByteBuf data;

    public NetherDeckRawPayload(CustomPacketPayload.Type<NetherDeckRawPayload> type, ByteBuf raw) {
        Objects.requireNonNull(type, "type cannot be null");
        this.type = type;
        this.data = raw;
    }

    public NetherDeckRawPayload(CustomPacketPayload.Type<NetherDeckRawPayload> type, byte[] raw) {
        this(type, Unpooled.wrappedBuffer(raw));
    }

    @Override
    public Type<NetherDeckRawPayload> type() {
        return type;
    }

    @Override
    public ByteBuf netherdeck$getRawData() {
        return data;
    }

    @Override
    public void netherdeck$setData(ByteBuf data) {
        this.data = data;
    }
}
