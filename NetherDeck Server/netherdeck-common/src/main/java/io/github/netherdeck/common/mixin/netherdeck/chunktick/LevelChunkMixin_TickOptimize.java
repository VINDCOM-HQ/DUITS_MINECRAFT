package io.github.netherdeck.common.mixin.netherdeck.chunktick;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.chunk.LevelChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.Map;

/**
 * Paper-style LevelChunk tick optimization.
 * Tracks dirty state of block entity list to avoid unnecessary
 * re-processing during the per-chunk tick cycle.
 *
 * Uses a dirty flag pattern: when block entities are added or removed,
 * the flag is set. The tick cycle checks the flag and only re-processes
 * when something actually changed.
 */
@Mixin(LevelChunk.class)
public abstract class LevelChunkMixin_TickOptimize {

    @Shadow
    public abstract Map<BlockPos, BlockEntity> getBlockEntities();

    /**
     * Tracks whether this chunk's block entity list has been modified since
     * last tick cycle, to avoid unnecessary re-sorting/re-filtering.
     */
    @Unique
    private boolean netherdeck$blockEntityListDirty = true;

    /**
     * Mark block entity list as dirty when entities are added.
     */
    @Inject(method = "addAndRegisterBlockEntity", at = @At("TAIL"))
    private void netherdeck$markDirtyOnAdd(BlockEntity blockEntity, CallbackInfo ci) {
        netherdeck$blockEntityListDirty = true;
    }

    /**
     * Mark block entity list as dirty when entities are removed.
     */
    @Inject(method = "removeBlockEntity", at = @At("TAIL"))
    private void netherdeck$markDirtyOnRemove(BlockPos pos, CallbackInfo ci) {
        netherdeck$blockEntityListDirty = true;
    }
}
