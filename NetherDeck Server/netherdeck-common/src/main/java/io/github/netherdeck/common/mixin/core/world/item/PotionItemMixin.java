package io.github.netherdeck.common.mixin.core.world.item;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.PotionItem;
import org.bukkit.event.entity.EntityPotionEffectEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(PotionItem.class)
public class PotionItemMixin {

    @Decorate(method = "*", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;addEffect(Lnet/minecraft/world/effect/MobEffectInstance;)Z"))
    private static boolean netherdeck$drinkPotion(LivingEntity instance, MobEffectInstance mobEffectInstance) throws Throwable {
        ((LivingEntityBridge) instance).bridge$pushEffectCause(EntityPotionEffectEvent.Cause.POTION_DRINK);
        return (boolean) DecorationOps.callsite().invoke(instance, mobEffectInstance);
    }
}
