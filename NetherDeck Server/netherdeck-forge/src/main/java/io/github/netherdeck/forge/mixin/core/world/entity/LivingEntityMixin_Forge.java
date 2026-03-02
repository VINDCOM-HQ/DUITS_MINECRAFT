package io.github.netherdeck.forge.mixin.core.world.entity;

import io.github.netherdeck.common.bridge.core.entity.LivingEntityBridge;
import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import io.github.netherdeck.common.mod.util.NetherDeckDamageContainer;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import io.github.netherdeck.mixin.Local;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraftforge.common.ForgeHooks;
import net.minecraftforge.event.ForgeEventFactory;
import net.minecraftforge.event.entity.living.ShieldBlockEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.jetbrains.annotations.Nullable;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.Collection;
import java.util.function.Consumer;

@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin_Forge extends EntityMixin_Forge implements LivingEntityBridge {

    // @formatter:off
    @Shadow protected abstract void dropExperience(@Nullable Entity entity);
    // @formatter:on

    @Redirect(method = "dropAllDeathLoot", at = @At(value = "INVOKE", ordinal = 0, remap = false, target = "Lnet/minecraft/world/entity/LivingEntity;captureDrops(Ljava/util/Collection;)Ljava/util/Collection;"))
    private Collection<ItemEntity> netherdeck$captureIfNeed(LivingEntity
                                                              livingEntity, Collection<ItemEntity> value) {
        Collection<ItemEntity> drops = livingEntity.captureDrops();
        // todo this instanceof ArmorStandEntity
        return drops == null ? livingEntity.captureDrops(value) : drops;
    }

    @Redirect(method = "dropAllDeathLoot", at = @At(value = "INVOKE", remap = false, target = "Ljava/util/Collection;forEach(Ljava/util/function/Consumer;)V"))
    private void netherdeck$cancelEvent(Collection<ItemEntity> collection, Consumer<ItemEntity> action) {
        if (this instanceof ServerPlayerEntityBridge) {
            // recapture for ServerPlayerEntityMixin#onDeath
            this.captureDrops(collection);
        } else {
            collection.forEach(action);
        }
    }

    @Redirect(method = "dropAllDeathLoot", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;dropExperience(Lnet/minecraft/world/entity/Entity;)V"))
    private void netherdeck$dropLater(LivingEntity instance, Entity entity) {
    }

    @Inject(method = "dropAllDeathLoot", at = @At("RETURN"))
    private void netherdeck$dropLast(ServerLevel arg, DamageSource damageSource, CallbackInfo ci) {
        this.dropExperience(damageSource.getEntity());
    }

    @Decorate(method = "hurt", inject = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/LivingEntity;isSleeping()Z"))
    private void netherdeck$entityDamageEvent(DamageSource damagesource, float originalDamage, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        EntityDamageEvent event = netherdeck$fireEntityDamageEvent(damagesource, originalDamage);

        if (event == null || event.isCancelled()) {
            DecorationOps.cancel().invoke(false);
            return;
        }

        originalDamage = (float) event.getDamage();
        container = new NetherDeckDamageContainer(event);
        DecorationOps.blackhole().invoke(originalDamage, container);

        if (damagesource.getEntity() instanceof net.minecraft.world.entity.player.Player) {
            ((net.minecraft.world.entity.player.Player) damagesource.getEntity()).resetAttackStrengthTicker();
        }
    }

    @Decorate(method = "hurt", at = @At(value = "INVOKE", target = "Lnet/minecraftforge/event/ForgeEventFactory;onShieldBlock(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/damagesource/DamageSource;F)Lnet/minecraftforge/event/entity/living/ShieldBlockEvent;"))
    private ShieldBlockEvent netherdeck$neoforge$postApplyShield(LivingEntity blocker, DamageSource source, float originalBlocked, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        ShieldBlockEvent result = (ShieldBlockEvent) DecorationOps.callsite().invoke(blocker, source, originalBlocked);
        float bukkit = -(float) container.getBukkit().getDamage(EntityDamageEvent.DamageModifier.BLOCKING);
        if (result.getBlockedDamage() == result.getOriginalBlockedDamage() && bukkit > 0.0F) {
            result.setBlockedDamage(bukkit);
        }
        container.applyOffset(-result.getBlockedDamage());
        return result;
    }

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
    private void netherdeck$vanilla$setCurrentEvent(DamageSource source, float original, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        NetherDeckCaptures.captureDamageContainer(container);
    }

    @Decorate(method = "actuallyHurt", inject = true, at = @At("HEAD"))
    private void netherdeck$vanilla$getEntityDamageEvent(DamageSource damageSource, float f, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        container = NetherDeckCaptures.getDamageContainer();
        DecorationOps.blackhole().invoke(container);
    }

    @Decorate(method = "actuallyHurt", at = @At(value = "INVOKE", target = "Lnet/minecraftforge/common/ForgeHooks;onLivingHurt(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/damagesource/DamageSource;F)F"))
    private float netherdeck$forge$applyFromLivingHurt(LivingEntity entity, DamageSource src, float amount, @Local(allocate = "netherdeckDamageContainer") NetherDeckDamageContainer container) throws Throwable {
        float result = (float) DecorationOps.callsite().invoke(entity, src, amount);
        container.setCurrentDamage(result);
        return result;
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

    @Override
    public boolean bridge$forge$onLivingUseTotem(LivingEntity entity, DamageSource damageSource, ItemStack totem, InteractionHand hand) {
        return ForgeHooks.onLivingUseTotem(entity, damageSource, totem, hand);
    }

    @Override
    public void bridge$forge$onLivingConvert(LivingEntity entity, LivingEntity outcome) {
        ForgeEventFactory.onLivingConvert(entity, outcome);
    }

    @Override
    public boolean bridge$forge$canEntityDestroy(Level level, BlockPos pos, LivingEntity entity) {
        return ForgeHooks.canEntityDestroy(level, pos, entity);
    }
}
