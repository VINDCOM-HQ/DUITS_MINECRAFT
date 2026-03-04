package io.github.netherdeck.common.mixin.core.world.item;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.PotionItem;
import net.minecraft.world.level.Level;
import org.bukkit.event.entity.EntityPotionEffectEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(PotionItem.class)
public class PotionItemMixin {

    // In 1.21.1, finishUsingItem applies effects via forEachEffect(entity::addEffect) — a method
    // reference — so the addEffect INVOKE is no longer directly visible in finishUsingItem bytecode.
    // We inject at HEAD to push the cause before any effects are applied.
    // Note: for multi-effect potions, only the first addEffect call will see POTION_DRINK (the cause
    // is consumed on read); subsequent effects fall back to UNKNOWN. This is an acceptable regression
    // from the old per-call-site @Decorate approach.
    @Inject(method = "finishUsingItem", require = 0, at = @At("HEAD"))
    private void netherdeck$drinkPotion(ItemStack stack, Level level, LivingEntity livingEntity, CallbackInfoReturnable<ItemStack> cir) {
        ((LivingEntityBridge) livingEntity).bridge$pushEffectCause(EntityPotionEffectEvent.Cause.POTION_DRINK);
    }
}
