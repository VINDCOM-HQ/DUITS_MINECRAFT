package io.github.netherdeck.common.mixin.core.world.entity.monster;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import net.minecraft.world.entity.monster.Illusioner;
import org.bukkit.event.entity.EntityPotionEffectEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(targets = "net.minecraft.world.entity.monster.Illusioner$IllusionerMirrorSpellGoal")
public class Illusioner_MirrorSpellGoalMixin {
    @SuppressWarnings("target")
    @Shadow(aliases = {"this$0", "f_32955_", "field_7300"}, remap = false)
    private Illusioner outerThis;

    @Inject(method = "performSpellCasting", at = @At("HEAD"))
    private void netherdeck$reason(CallbackInfo ci) {
        ((LivingEntityBridge) outerThis).bridge$pushEffectCause(EntityPotionEffectEvent.Cause.ILLUSION);
    }
}