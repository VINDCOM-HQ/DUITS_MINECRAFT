package io.github.netherdeck.common.mixin.vanilla.world.effect;

import io.github.netherdeck.common.bridge.core.util.DamageSourcesBridge;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.damagesource.DamageSources;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(targets = "net.minecraft.world.effect.PoisonMobEffect")
public class PoisonMobEffectMixin_Vanilla {

    @Redirect(method = "applyEffectTick", require = 0, at = @At(value = "INVOKE", ordinal = 0, target = "Lnet/minecraft/world/damagesource/DamageSources;magic()Lnet/minecraft/world/damagesource/DamageSource;"))
    private DamageSource netherdeck$redirectPoison(DamageSources instance) {
        return ((DamageSourcesBridge) instance).bridge$poison();
    }
}
