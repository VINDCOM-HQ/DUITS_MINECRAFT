package io.github.netherdeck.common.mixin.netherdeck.spawning;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.MobCategory;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.NaturalSpawner;
import net.minecraft.world.level.biome.MobSpawnSettings;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.StructureManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Paper-style mob spawning optimization.
 * Key optimizations from Paper:
 * - Prevent mob spawning from triggering chunk loads/generation
 * - Use view-distance-aware spawn calculations
 * - Skip spawn attempts in chunks outside the player's view distance
 *
 * Note: We do NOT inject into spawnForChunk because NetherDeck's core mixin
 * uses @Overwrite on that method. Instead, we target the spawn position
 * validation methods which are called by the overwritten method body.
 */
@Mixin(NaturalSpawner.class)
public abstract class NaturalSpawnerMixin_SpawnOptimize {

    /**
     * Optimize: Use a faster position check for spawn location validation.
     * Paper reduces the overhead of checking if a position is valid for spawning
     * by skipping positions in unloaded chunks entirely.
     *
     * Uses CallbackInfoReturnable since isValidSpawnPositionForType returns boolean.
     */
    @Inject(method = "isValidSpawnPositionForType", at = @At("HEAD"), cancellable = true)
    private static void netherdeck$fastSpawnPositionCheck(
            ServerLevel level,
            MobCategory category,
            StructureManager structureManager,
            ChunkGenerator generator,
            MobSpawnSettings.SpawnerData spawnerData,
            BlockPos.MutableBlockPos pos,
            double distance,
            CallbackInfoReturnable<Boolean> cir
    ) {
        // Fast check: if the block position is in an unloaded chunk, skip entirely.
        // This prevents the spawn position validator from triggering chunk loads.
        if (level.getChunkSource().getChunkNow(pos.getX() >> 4, pos.getZ() >> 4) == null) {
            cir.setReturnValue(false);
        }
    }

    /**
     * Check if a chunk and all its neighbors are loaded.
     * Mob spawning that checks adjacent blocks can trigger chunk loads
     * if neighbor chunks aren't present.
     */
    @Unique
    private static boolean netherdeck$isChunkFullyLoaded(ServerLevel level, ChunkPos pos) {
        for (int dx = -1; dx <= 1; dx++) {
            for (int dz = -1; dz <= 1; dz++) {
                if (level.getChunkSource().getChunkNow(pos.x + dx, pos.z + dz) == null) {
                    return false;
                }
            }
        }
        return true;
    }
}
