package io.github.netherdeck.common.mixin.vanilla.world.entity;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import io.github.netherdeck.common.bridge.vanilla.world.entity.LivingEntityBridge_Vanilla;
import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import io.github.netherdeck.common.mod.util.NetherDeckDamageContainer;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import org.bukkit.event.entity.EntityDamageEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin_Vanilla extends EntityMixin_Vanilla implements LivingEntityBridge, LivingEntityBridge_Vanilla {

    @Inject(method = "dropAllDeathLoot", at = @At("HEAD"))
    private void netherdeck$startCapture(ServerLevel serverLevel, DamageSource damageSource, CallbackInfo ci) {
        this.netherdeck$startCaptureDrops();
    }

    @Inject(method = "dropAllDeathLoot", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;dropExperience(Lnet/minecraft/world/entity/Entity;)V"))
    private void netherdeck$stopCapture(ServerLevel serverLevel, DamageSource damageSource, CallbackInfo ci) {
        final var list = this.netherdeck$finishCaptureDrops();
        this.netherdeck$vanilla$callLivingDropsEvent(damageSource, list);
        list.forEach(serverLevel::addFreshEntity);
    }

    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;isSleeping()Z"))
    private void netherdeck$entityDamageEvent(DamageSource damagesource, float originalDamage, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        EntityDamageEvent event = netherdeck$fireEntityDamageEvent(damagesource, originalDamage);

        if (event == null || event.isCancelled()) {
            DecorationOps.cancel().invoke(false);
            return;
        }

        container = new NetherDeckDamageContainer(event);
        originalDamage = (float) event.getDamage();
        DecorationOps.blackhole().invoke(container, originalDamage);

        if (damagesource.getEntity() instanceof net.minecraft.world.entity.player.Player) {
            ((net.minecraft.world.entity.player.Player) damagesource.getEntity()).resetAttackStrengthTicker();
        }
    }

    // Special handle; assuming shield cut out at most BLOCKING damage from original and g means the damage that will be used to calculate exact blocking.
    // Merged Bukkit & Modded calculation result with the above assumption. Be careful.
    /*
    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;isDamageSourceBlocked(Lnet/minecraft/world/damagesource/DamageSource;)Z"))
    private void netherdeck$vanilla$preApplyShield(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        double blocking = event.getDamage(EntityDamageEvent.DamageModifier.BLOCKING);
        if (blocking == 0.0F) return;
        original = -(float) blocking;
        DecorationOps.blackhole().invoke(original);
    }
    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", ordinal = 2, target = "Lnet/minecraft/world/damagesource/DamageSource;is(Lnet/minecraft/tags/TagKey;)Z"))
    private void netherdeck$vanilla$postApplyShield(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        double before = -event.getDamage(EntityDamageEvent.DamageModifier.BLOCKING);
        if (before == -0.0F) return;
        double actualOffset = before - original;
        event.setDamage(EntityDamageEvent.DamageModifier.BLOCKING, actualOffset);
    }
    */

    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", ordinal = 2, target = "Lnet/minecraft/world/damagesource/DamageSource;is(Lnet/minecraft/tags/TagKey;)Z"))
    private void netherdeck$vanilla$postApplyShield(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        original = container.calculateStage(EntityDamageEvent.DamageModifier.BLOCKING, original);
        DecorationOps.blackhole().invoke(original);
    }

    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", ordinal = 3, target = "Lnet/minecraft/world/damagesource/DamageSource;is(Lnet/minecraft/tags/TagKey;)Z"))
    private void netherdeck$vanilla$postApplyFreezing(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        original = container.calculateStage(EntityDamageEvent.DamageModifier.FREEZING, original);
        DecorationOps.blackhole().invoke(original);
    }

    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/WalkAnimationState;setSpeed(F)V"))
    private void netherdeck$vanilla$postApplyHardHat(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        original = container.calculateStage(EntityDamageEvent.DamageModifier.HARD_HAT, original);
        DecorationOps.blackhole().invoke(original);
    }

    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;actuallyHurt(Lnet/minecraft/world/damagesource/DamageSource;F)V"))
    private void netherdeck$vanilla$captureEntityDamageEvent(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        NetherDeckCaptures.captureDamageContainer(container);
    }

    @Decorate(method = "actuallyHurt", inject = true, at = @At("HEAD"))
    private void netherdeck$vanilla$getEntityDamageEvent(DamageSource damageSource, float f, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        container = NetherDeckCaptures.getDamageContainer();
        DecorationOps.blackhole().invoke(container);
    }

    @Decorate(method = "actuallyHurt", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;getDamageAfterMagicAbsorb(Lnet/minecraft/world/damagesource/DamageSource;F)F"))
    private void netherdeck$vanilla$postApplyArmor(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        original = container.calculateStage(EntityDamageEvent.DamageModifier.ARMOR, original);
        DecorationOps.blackhole().invoke(original);
    }

    @Decorate(method = "getDamageAfterMagicAbsorb", at = @At(value = "INVOKE", target = "Ljava/lang/Math;max(FF)F"))
    private float netherdeck$vanilla$postApplyResistance(float first, float second) throws Throwable {
        float result = (float) DecorationOps.callsite().invoke(first, second);
        result = NetherDeckCaptures.getDamageContainer().calculateStage(EntityDamageEvent.DamageModifier.RESISTANCE, result);
        return result;
    }

    @Decorate(method = "actuallyHurt", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;getDamageAfterMagicAbsorb(Lnet/minecraft/world/damagesource/DamageSource;F)F"))
    private float netherdeck$vanilla$postApplyMagic(LivingEntity entity, DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
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
