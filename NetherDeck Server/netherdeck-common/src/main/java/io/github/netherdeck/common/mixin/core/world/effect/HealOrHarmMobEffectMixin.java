package io.github.netherdeck.common.mixin.core.world.effect;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import org.bukkit.event.entity.EntityRegainHealthEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "net.minecraft.world.effect.HealOrHarmMobEffect")
public class HealOrHarmMobEffectMixin {

    @Inject(method = "applyEffectTick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;heal(F)V"))
    private void netherdeck$healReason1(LivingEntity livingEntity, int amplifier, CallbackInfoReturnable<Boolean> cir) {
        ((LivingEntityBridge) livingEntity).bridge$pushHealReason(EntityRegainHealthEvent.RegainReason.MAGIC);
    }

    @Inject(method = "applyInstantenousEffect", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;heal(F)V"))
    private void netherdeck$healReason1(Entity source, Entity indirectSource, LivingEntity livingEntity, int amplifier, double health, CallbackInfo ci) {
        ((LivingEntityBridge) livingEntity).bridge$pushHealReason(EntityRegainHealthEvent.RegainReason.MAGIC);
    }

}
