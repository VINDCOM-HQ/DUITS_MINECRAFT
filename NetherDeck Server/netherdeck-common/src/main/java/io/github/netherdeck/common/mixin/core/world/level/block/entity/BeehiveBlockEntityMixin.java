package io.github.netherdeck.common.mixin.core.world.level.block.entity;

import com.google.common.collect.Lists;
import io.github.netherdeck.common.bridge.core.entity.MobEntityBridge;
import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.animal.Bee;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BeehiveBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.v.block.CraftBlock;
import org.bukkit.event.entity.EntityEnterBlockEvent;
import org.bukkit.event.entity.EntityRemoveEvent;
import org.bukkit.event.entity.EntityTargetEvent;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Overwrite;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import javax.annotation.Nullable;
import java.util.List;

@Mixin(BeehiveBlockEntity.class)
public abstract class BeehiveBlockEntityMixin extends BlockEntityMixin {

    // @formatter:off
    @Shadow private List<BeehiveBlockEntity.BeeData> stored;
    @Shadow @Nullable public BlockPos savedFlowerPos;
    @Shadow private static boolean releaseOccupant(Level arg, BlockPos arg2, BlockState arg3, BeehiveBlockEntity.Occupant arg4, @org.jetbrains.annotations.Nullable List<Entity> list, BeehiveBlockEntity.BeeReleaseStatus arg5, @org.jetbrains.annotations.Nullable BlockPos arg6) { return false; }
    // @formatter:on

    public int maxBees = 3;

    /**
     * @author IzzelAliz
     * @reason
     */
    @Overwrite
    public boolean isFull() {
        return this.stored.size() >= maxBees;
    }

    @Redirect(method = "emptyAllLivingFromHive", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/animal/Bee;setTarget(Lnet/minecraft/world/entity/LivingEntity;)V"))
    private void netherdeck$angryReason(Bee beeEntity, LivingEntity livingEntity) {
        ((MobEntityBridge) beeEntity).bridge$pushGoalTargetReason(EntityTargetEvent.TargetReason.CLOSEST_PLAYER, true);
        beeEntity.setTarget(livingEntity);
    }

    public List<Entity> releaseBees(BlockState blockState, BeehiveBlockEntity.BeeReleaseStatus state, boolean force) {
        List<Entity> list = Lists.newArrayList();
        this.stored.removeIf(bee -> releaseBee(level, worldPosition, blockState, bee, list, state, this.savedFlowerPos, force));
        return list;
    }

    @Redirect(method = "addOccupant", at = @At(value = "INVOKE", remap = false, target = "Ljava/util/List;size()I"))
    private int netherdeck$maxBee(List<?> list) {
        return list.size() < this.maxBees ? 1 : 3;
    }

    @Inject(method = "addOccupant", cancellable = true, at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/Entity;stopRiding()V"))
    private void netherdeck$beeEnterBlock(Entity entity, CallbackInfo ci) {
        if (this.level != null) {
            EntityEnterBlockEvent event = new EntityEnterBlockEvent(entity.bridge$getBukkitEntity(), CraftBlock.at(this.level, this.worldPosition));
            Bukkit.getPluginManager().callEvent(event);
            if (event.isCancelled()) {
                if (entity instanceof Bee) {
                    ((Bee) entity).setStayOutOfHiveCountdown(400);
                }
                ci.cancel();
            }
        }
    }

    @Inject(method = "addOccupant", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/Entity;discard()V"))
    private void netherdeck$enterBlockCause(Entity entity, CallbackInfo ci) {
        entity.bridge().bridge$pushEntityRemoveCause(EntityRemoveEvent.Cause.ENTER_BLOCK);
    }

    private static boolean releaseBee(Level world, BlockPos pos, BlockState state, BeehiveBlockEntity.BeeData beeData, @Nullable List<Entity> list, BeehiveBlockEntity.BeeReleaseStatus status, @Nullable BlockPos pos1, boolean force) {
        netherdeck$force = force;
        try {
            return releaseOccupant(world, pos, state, beeData.toOccupant(), list, status, pos1);
        } finally {
            netherdeck$force = false;
        }
    }

    private static transient boolean netherdeck$force;

    @Redirect(method = "releaseOccupant", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/level/Level;isNight()Z"))
    private static boolean netherdeck$bypassNightCheck(Level world) {
        return !netherdeck$force && world.isNight();
    }

    @Inject(method = "loadAdditional", at = @At("RETURN"))
    private void netherdeck$readMax(CompoundTag compound, HolderLookup.Provider provider, CallbackInfo ci) {
        if (compound.contains("Bukkit.MaxEntities")) {
            this.maxBees = compound.getInt("Bukkit.MaxEntities");
        }
    }

    @Inject(method = "saveAdditional", at = @At("RETURN"))
    private void netherdeck$writeMax(CompoundTag compound, HolderLookup.Provider provider, CallbackInfo ci) {
        compound.putInt("Bukkit.MaxEntities", this.maxBees);
    }
}
