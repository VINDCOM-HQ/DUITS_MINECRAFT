package io.github.netherdeck.common.mixin.core.world.effect;

import io.github.netherdeck.common.bridge.core.entity.player.PlayerEntityBridge;
import net.minecraft.world.entity.LivingEntity;
import org.bukkit.event.entity.EntityExhaustionEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "net.minecraft.world.effect.HungerMobEffect")
public class HungerMobEffectMixin {

    @Inject(method = "applyEffectTick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/player/Player;causeFoodExhaustion(F)V"))
    private void netherdeck$reason(LivingEntity livingEntity, int amplifier, CallbackInfoReturnable<Boolean> cir) {
        ((PlayerEntityBridge) livingEntity).bridge$pushExhaustReason(EntityExhaustionEvent.ExhaustionReason.HUNGER_EFFECT);
    }
}
