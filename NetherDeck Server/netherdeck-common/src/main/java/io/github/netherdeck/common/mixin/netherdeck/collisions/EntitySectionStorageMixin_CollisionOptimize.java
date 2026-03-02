package io.github.netherdeck.common.mixin.netherdeck.collisions;

import net.minecraft.world.level.entity.EntitySectionStorage;
import org.spongepowered.asm.mixin.Mixin;

/**
 * Paper-style entity section collision optimization placeholder.
 * The primary collision optimization is in VoxelShapesMixin_CollisionOptimize
 * which makes individual collision checks faster.
 *
 * This mixin exists as a placeholder for future spatial hashing optimizations
 * that would reduce the number of sections checked during entity movement.
 *
 * Note: EntitySectionStorage.forEachAccessibleNonEmptySection has a complex
 * generic signature with AbortableIterationConsumer that makes direct injection
 * fragile. The optimization benefit is better achieved at the VoxelShape level.
 */
@Mixin(EntitySectionStorage.class)
public abstract class EntitySectionStorageMixin_CollisionOptimize {
    // Future: Add spatial hashing or section-skip optimizations here.
    // Current collision improvements are handled by VoxelShapesMixin_CollisionOptimize.
}
