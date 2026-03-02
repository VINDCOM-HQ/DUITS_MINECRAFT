package io.github.netherdeck.common.mixin.core.world.entity.animal;

import io.github.netherdeck.common.bridge.core.util.DamageSourcesBridge;
import io.github.netherdeck.common.bridge.core.world.IWorldBridge;
import io.github.netherdeck.common.mod.server.event.NetherDeckEventFactory;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.damagesource.DamageSources;
import org.bukkit.craftbukkit.v.block.CraftBlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import io.github.netherdeck.common.mixin.core.world.entity.PathfinderMobMixin;
import net.minecraft.core.BlockPos;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.animal.SnowGolem;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(SnowGolem.class)
public abstract class SnowGolemMixin extends PathfinderMobMixin {

    @Redirect(method = "aiStep", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/damagesource/DamageSources;onFire()Lnet/minecraft/world/damagesource/DamageSource;"))
    private DamageSource netherdeck$useMelting(DamageSources instance) {
        return ((DamageSourcesBridge) instance).bridge$melting();
    }

    @Decorate(method = "aiStep", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/Level;setBlockAndUpdate(Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;)Z"))
    private boolean netherdeck$blockForm(Level world, BlockPos pos, BlockState newState) throws Throwable {
        if (IWorldBridge.from(world) instanceof IWorldBridge bridge) {
            final var event = NetherDeckEventFactory.callBlockFormEvent(bridge.bridge$getMinecraftWorld(), pos, newState, 3, (SnowGolem) (Object) this);
            if (event != null) {
                if (event.isCancelled()) {
                    return false;
                }
                newState = ((CraftBlockState) event.getNewState()).getHandle();
            }
        }
        return (boolean) DecorationOps.callsite().invoke(world, pos, newState);
    }

    @Inject(method = "shear", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/animal/SnowGolem;spawnAtLocation(Lnet/minecraft/world/item/ItemStack;F)Lnet/minecraft/world/entity/item/ItemEntity;"))
    private void netherdeck$forceDropOn(SoundSource pCategory, CallbackInfo ci) {
        this.forceDrops = true;
    }

    @Inject(method = "shear", at = @At(value = "INVOKE", shift = At.Shift.AFTER, target = "Lnet/minecraft/world/entity/animal/SnowGolem;spawnAtLocation(Lnet/minecraft/world/item/ItemStack;F)Lnet/minecraft/world/entity/item/ItemEntity;"))
    private void netherdeck$forceDropOff(SoundSource pCategory, CallbackInfo ci) {
        this.forceDrops = false;
    }
}
