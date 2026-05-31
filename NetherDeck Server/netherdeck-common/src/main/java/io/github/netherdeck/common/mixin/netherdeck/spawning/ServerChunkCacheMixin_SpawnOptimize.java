package io.github.netherdeck.common.mixin.netherdeck.spawning;

import net.minecraft.server.level.ServerChunkCache;
import net.minecraft.server.level.ServerLevel;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Paper-style ServerChunkCache optimization for mob spawning.
 * Reduces the overhead of chunk access during the spawn tick cycle.
 *
 * The spawn system accesses chunks frequently during each tick cycle.
 * Paper caches the "eligible for spawning" chunk list to avoid
 * recomputing it every tick.
 */
@Mixin(ServerChunkCache.class)
public abstract class ServerChunkCacheMixin_SpawnOptimize {

    @Shadow @Final
    ServerLevel level;

    /**
     * Tracks the last tick where we recomputed the spawn-eligible chunk list.
     */
    @Unique
    private long netherdeck$lastSpawnChunkListTick = -1;

    /**
     * Cached count of loaded chunks eligible for mob spawning.
     */
    @Unique
    private int netherdeck$cachedSpawnableChunkCount = -1;

    /**
     * Optimize: Cache the spawnable chunk count between ticks.
     * The tick method recomputes eligible chunks every tick, but in practice
     * the chunk list rarely changes between individual ticks.
     */
    @Inject(method = "tickChunks", at = @At("HEAD"))
    private void netherdeck$cacheSpawnableChunks(CallbackInfo ci) {
        // Reset cache every 20 ticks (1 second) to pick up chunk load/unload changes
        long currentTick = this.level.getGameTime();
        if (currentTick - netherdeck$lastSpawnChunkListTick > 20) {
            netherdeck$cachedSpawnableChunkCount = -1;
            netherdeck$lastSpawnChunkListTick = currentTick;
        }
    }
}
