package io.github.netherdeck.common.mixin.core.world.level.block.state;

import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockBehaviour;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(BlockBehaviour.BlockStateBase.class)
public class BlockBehaviour_BlockStateBaseMixin {

    @Inject(method = "entityInside", at = @At("HEAD"))
    private void netherdeck$captureBlockCollide(Level worldIn, BlockPos pos, Entity entityIn, CallbackInfo ci) {
        NetherDeckCaptures.captureDamageEventBlock(pos);
    }

    @Inject(method = "entityInside", at = @At("RETURN"))
    private void netherdeck$resetBlockCollide(Level worldIn, BlockPos pos, Entity entityIn, CallbackInfo ci) {
        NetherDeckCaptures.captureDamageEventBlock(null);
    }
}
