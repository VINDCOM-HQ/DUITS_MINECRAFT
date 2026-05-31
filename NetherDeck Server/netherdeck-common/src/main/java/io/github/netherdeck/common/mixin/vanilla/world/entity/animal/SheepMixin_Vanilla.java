package io.github.netherdeck.common.mixin.vanilla.world.entity.animal;

import io.github.netherdeck.common.mixin.core.world.entity.animal.AnimalMixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(net.minecraft.world.entity.animal.Sheep.class)
public abstract class SheepMixin_Vanilla extends AnimalMixin {
    @Inject(method = "shear", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/animal/Sheep;spawnAtLocation(Lnet/minecraft/world/level/ItemLike;I)Lnet/minecraft/world/entity/item/ItemEntity;"))
    private void netherdeck$forceDrop(CallbackInfo ci) { forceDrops = true; }

    @Inject(method = "shear", at = @At(value = "INVOKE", shift = At.Shift.AFTER, target = "Lnet/minecraft/world/entity/animal/Sheep;spawnAtLocation(Lnet/minecraft/world/level/ItemLike;I)Lnet/minecraft/world/entity/item/ItemEntity;"))
    private void netherdeck$forceDropReset(CallbackInfo ci) { forceDrops = false; }
}