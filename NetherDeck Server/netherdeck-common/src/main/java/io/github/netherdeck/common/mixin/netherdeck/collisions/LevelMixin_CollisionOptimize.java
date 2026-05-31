package io.github.netherdeck.common.mixin.netherdeck.collisions;

import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.shapes.VoxelShape;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.List;

/**
 * Paper/Tuinity-style Level collision optimization.
 * Optimizes getEntityCollisions to reduce unnecessary VoxelShape
 * computation during entity movement.
 *
 * Key optimization: early-exit for empty/invalid AABB queries.
 */
@Mixin(Level.class)
public abstract class LevelMixin_CollisionOptimize {

    /**
     * Optimize entity collision gathering.
     * Paper's optimization: when checking entity collisions with an
     * empty or zero-size AABB, return empty immediately without
     * iterating any entity sections.
     */
    @Inject(method = "getEntityCollisions", at = @At("HEAD"), cancellable = true)
    private void netherdeck$fastEntityCollisions(Entity entity, AABB aabb, CallbackInfoReturnable<List<VoxelShape>> cir) {
        // Fast path: if the AABB has zero volume, no collisions possible
        if (aabb.getXsize() <= 0.0 || aabb.getYsize() <= 0.0 || aabb.getZsize() <= 0.0) {
            cir.setReturnValue(List.of());
        }
    }
}
