package io.github.netherdeck.common.mixin.netherdeck.hoppers;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.entity.Hopper;
import net.minecraft.world.level.block.entity.HopperBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Paper-style hopper optimization.
 * - Skips empty container checks above hoppers when there's nothing to pull
 * - Uses a transfer cooldown to avoid unnecessary ticking
 * - Skips pulling from empty containers entirely
 *
 * Based on Paper's hopper optimization patches.
 */
@Mixin(HopperBlockEntity.class)
public abstract class HopperBlockEntityMixin extends BlockEntity {

    @Unique
    private long netherdeck$lastTickedGameTime;

    @Unique
    private boolean netherdeck$shouldSkipPull;

    public HopperBlockEntityMixin(BlockEntityType<?> type, BlockPos pos, BlockState state) {
        super(type, pos, state);
    }

    /**
     * Optimize: Skip suck/pull operations when the container above is empty.
     * This is the biggest single hopper optimization from Paper.
     * We track whether the last pull found any items, and skip future attempts
     * until enough time passes to re-check.
     *
     * Note: We access our @Unique fields via casting to BlockEntity and using
     * the mixin duck interface pattern, since static methods receive the
     * target instance as a parameter, not the mixin type.
     */
    @Inject(method = "suckInItems", at = @At("HEAD"), cancellable = true)
    private static void netherdeck$skipEmptyPull(Level level, Hopper hopper, CallbackInfoReturnable<Boolean> cir) {
        // Access our unique fields through the BlockEntity cast
        // Mixin fields are injected into the target class at runtime
        if (((HopperBlockEntityMixin) (Object) hopper).netherdeck$shouldSkipPull) {
            long gameTime = level.getGameTime();
            if (gameTime - ((HopperBlockEntityMixin) (Object) hopper).netherdeck$lastTickedGameTime < 8L) {
                cir.setReturnValue(false);
                return;
            }
            ((HopperBlockEntityMixin) (Object) hopper).netherdeck$lastTickedGameTime = gameTime;
            ((HopperBlockEntityMixin) (Object) hopper).netherdeck$shouldSkipPull = false;
        }
    }

    /**
     * After a failed pull attempt, mark this hopper to skip future pulls temporarily.
     */
    @Inject(method = "suckInItems", at = @At("RETURN"))
    private static void netherdeck$markEmptyOnFailedPull(Level level, Hopper hopper, CallbackInfoReturnable<Boolean> cir) {
        if (!cir.getReturnValue()) {
            ((HopperBlockEntityMixin) (Object) hopper).netherdeck$shouldSkipPull = true;
            ((HopperBlockEntityMixin) (Object) hopper).netherdeck$lastTickedGameTime = level.getGameTime();
        }
    }

    /**
     * Optimize: Skip the push operation when the hopper itself is empty.
     */
    @Inject(method = "ejectItems", at = @At("HEAD"), cancellable = true)
    private static void netherdeck$skipFullDestination(Level level, BlockPos pos, HopperBlockEntity hopper, CallbackInfoReturnable<Boolean> cir) {
        boolean isEmpty = true;
        for (int i = 0; i < hopper.getContainerSize(); i++) {
            if (!hopper.getItem(i).isEmpty()) {
                isEmpty = false;
                break;
            }
        }
        if (isEmpty) {
            cir.setReturnValue(false);
        }
    }
}
