package io.github.netherdeck.common.mixin.vanilla.world.entity.player;

import io.github.netherdeck.common.mixin.vanilla.world.entity.LivingEntityMixin_Vanilla;
import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import io.github.netherdeck.common.mod.util.NetherDeckDamageContainer;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Abilities;
import net.minecraft.world.entity.player.Player;
import org.bukkit.event.entity.EntityDamageEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Player.class)
public abstract class PlayerMixin_Vanilla extends LivingEntityMixin_Vanilla {

    @Decorate(method = "actuallyHurt", inject = true, at = @At("HEAD"))
    private void netherdeck$vanilla$getEntityDamageEvent(DamageSource damageSource, float f, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        container = NetherDeckCaptures.getDamageContainer();
        DecorationOps.blackhole().invoke(container);
    }

    @Decorate(method = "actuallyHurt", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/player/Player;getDamageAfterMagicAbsorb(Lnet/minecraft/world/damagesource/DamageSource;F)F"))
    private void netherdeck$vanilla$postApplyArmor(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        original = container.calculateStage(EntityDamageEvent.DamageModifier.ARMOR, original);
        DecorationOps.blackhole().invoke(original);
    }

    @Decorate(method = "actuallyHurt", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/player/Player;getDamageAfterMagicAbsorb(Lnet/minecraft/world/damagesource/DamageSource;F)F"))
    private float netherdeck$vanilla$postApplyMagic(Player entity, DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        float result = (float) DecorationOps.callsite().invoke(entity, source, original);
        return container.calculateStage(EntityDamageEvent.DamageModifier.MAGIC, result);
    }

    @Decorate(method = "actuallyHurt", at = @At(value = "INVOKE", target = "Ljava/lang/Math;max(FF)F"))
    private float netherdeck$vanilla$postApplyAbsorption(float first, float second, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        float result = (float) DecorationOps.callsite().invoke(first, second);
        result = container.calculateStage(EntityDamageEvent.DamageModifier.ABSORPTION, result);
        return Math.max(result, 0.0F);
    }

    @Inject(method = "actuallyHurt", at = @At("RETURN"))
    private void netherdeck$vanilla$popEntityDamageEvent(DamageSource arg, float g, CallbackInfo ci) {
        NetherDeckCaptures.popDamageContainer();
    }
}
