package io.github.netherdeck.common.mixin.core.network.protocol.common.custom;

import io.github.netherdeck.common.mod.mixins.annotation.CreateConstructor;
import io.github.netherdeck.common.mod.mixins.annotation.ShadowConstructor;
import io.github.netherdeck.common.mod.plugin.messaging.RawPayload;
import io.netty.buffer.ByteBuf;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.network.protocol.common.custom.DiscardedPayload;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(DiscardedPayload.class)
public abstract class DiscardedPayloadMixin implements RawPayload {

    @ShadowConstructor
    public abstract void netherdeck$constructor(ResourceLocation rl);

    @CreateConstructor
    public void netherdeck$constructor(ResourceLocation rl, ByteBuf data) {
        netherdeck$constructor(rl);
        this.data = data.copy();
    }

    @Unique
    private ByteBuf data;

    @Unique
    public ByteBuf data() {
        return data;
    }

    @Unique
    @Override
    public ByteBuf netherdeck$getRawData() {
        return data();
    }

    @Unique
    @Override
    public void netherdeck$setData(ByteBuf data) {
        this.data = data;
    }

    @Inject(method = "codec", at = @At("HEAD"), cancellable = true)
    private static<T extends FriendlyByteBuf> void netherdeck$interceptCodec(ResourceLocation location, int i, CallbackInfoReturnable<StreamCodec<T, CustomPacketPayload>> cir) {
        cir.setReturnValue(RawPayload.discardedCodec(location, i));
    }
}
