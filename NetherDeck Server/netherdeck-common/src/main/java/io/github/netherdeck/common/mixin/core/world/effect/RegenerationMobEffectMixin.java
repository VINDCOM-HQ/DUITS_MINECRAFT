package io.github.netherdeck.common.mixin.core.world.effect;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import net.minecraft.world.entity.LivingEntity;
import org.bukkit.event.entity.EntityRegainHealthEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "net.minecraft.world.effect.RegenerationMobEffect")
public class RegenerationMobEffectMixin {

    @Inject(method = "applyEffectTick", at = @At(value = "INVOKE", ordinal = 0, target = "Lnet/minecraft/world/entity/LivingEntity;heal(F)V"))
    private void netherdeck$reason(LivingEntity livingEntity, int amplifier, CallbackInfoReturnable<Boolean> cir) {
        ((LivingEntityBridge) livingEntity).bridge$pushHealReason(EntityRegainHealthEvent.RegainReason.MAGIC_REGEN);
    }
}
