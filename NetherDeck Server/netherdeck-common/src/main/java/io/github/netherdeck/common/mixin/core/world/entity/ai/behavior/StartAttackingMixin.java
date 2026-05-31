package io.github.netherdeck.common.mixin.core.world.entity.ai.behavior;

import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.behavior.BehaviorControl;
import net.minecraft.world.entity.ai.behavior.StartAttacking;
import net.minecraft.world.entity.ai.behavior.declarative.BehaviorBuilder;
import net.minecraft.world.entity.ai.memory.MemoryModuleType;
import org.bukkit.craftbukkit.v.entity.CraftLivingEntity;
import org.bukkit.craftbukkit.v.event.CraftEventFactory;
import org.bukkit.event.entity.EntityTargetEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Overwrite;

import java.util.Optional;
import java.util.function.Function;
import java.util.function.Predicate;

@Mixin(StartAttacking.class)
public abstract class StartAttackingMixin {

    /**
     * @author NetherDeck
     * @reason Fire Bukkit EntityTargetEvent for plugin compatibility
     */
    @Overwrite
    public static <E extends Mob> BehaviorControl<E> create(Predicate<E> canAttackPredicate, Function<E, Optional<? extends LivingEntity>> targetFinder) {
        return BehaviorBuilder.create(c ->
            c.group(
                c.absent(MemoryModuleType.ATTACK_TARGET),
                c.registered(MemoryModuleType.CANT_REACH_WALK_TARGET_SINCE)
            ).apply(c, (attackTarget, cantReachWalkTarget) ->
                (world, mob, time) -> {
                    if (!canAttackPredicate.test(mob)) {
                        return false;
                    }
                    Optional<? extends LivingEntity> optional = targetFinder.apply(mob);
                    if (optional.isEmpty()) {
                        return false;
                    }
                    LivingEntity livingentity = optional.get();
                    if (!mob.canAttack(livingentity)) {
                        return false;
                    }
                    EntityTargetEvent event = CraftEventFactory.callEntityTargetLivingEvent(mob, livingentity,
                        (livingentity instanceof ServerPlayer) ? EntityTargetEvent.TargetReason.CLOSEST_PLAYER : EntityTargetEvent.TargetReason.CLOSEST_ENTITY);
                    if (event.isCancelled()) {
                        return false;
                    }
                    if (event.getTarget() == null) {
                        return false;
                    }
                    attackTarget.set((LivingEntity) ((CraftLivingEntity) event.getTarget()).getHandle());
                    cantReachWalkTarget.erase();
                    return true;
                }
            )
        );
    }
}
