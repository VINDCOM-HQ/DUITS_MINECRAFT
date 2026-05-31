package io.github.netherdeck.common.mixin.netherdeck.chunktick;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.chunk.LevelChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Paper-style chunk tick optimization for ServerLevel.
 * Reduces unnecessary iteration and processing during the chunk tick cycle.
 *
 * Key optimizations:
 * - Skip chunks with no block entities when random tick speed is 0
 * - Reduce redundant processing for inactive chunks
 */
@Mixin(ServerLevel.class)
public abstract class ServerLevelMixin_ChunkTickOptimize {

    /**
     * Optimize: Skip tick processing for chunks with no pending work.
     * Paper tracks which chunks have pending scheduled ticks and skips
     * the expensive tick() call for chunks with nothing to process.
     *
     * When random tick speed is 0 (gamerule randomTickSpeed=0) and
     * the chunk has no block entities, there's nothing to do.
     */
    @Inject(method = "tickChunk", at = @At("HEAD"), cancellable = true)
    private void netherdeck$skipEmptyChunkTick(LevelChunk chunk, int randomTickSpeed, CallbackInfo ci) {
        // Fast path: if random tick speed is 0, skip random ticks entirely
        // for chunks with no block entities (nothing else would tick)
        if (randomTickSpeed <= 0 && chunk.getBlockEntities().isEmpty()) {
            ci.cancel();
        }
    }
}
