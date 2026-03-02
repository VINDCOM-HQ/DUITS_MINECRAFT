package io.github.netherdeck.common.mixin.netherdeck.collisions;

import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.shapes.BooleanOp;
import net.minecraft.world.phys.shapes.Shapes;
import net.minecraft.world.phys.shapes.VoxelShape;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Paper/Tuinity-style collision detection optimization.
 * Extends NetherDeck's existing VoxelShapes optimization with additional
 * AABB-based fast paths that avoid full VoxelShape computation.
 *
 * The key insight from Paper is that most collision checks involve
 * simple AABB shapes (full blocks), so we can short-circuit the expensive
 * VoxelShape merging with simple AABB math.
 */
@Mixin(Shapes.class)
public abstract class VoxelShapesMixin_CollisionOptimize {

    /**
     * Optimize joinIsNotEmpty for the common case of AABB vs AABB.
     * Paper's collision optimization: when both shapes are simple AABBs,
     * use direct AABB intersection instead of VoxelShape boolean operations.
     * This is the single biggest collision optimization from Tuinity/Paper.
     */
    @Inject(method = "joinIsNotEmpty(Lnet/minecraft/world/phys/shapes/VoxelShape;Lnet/minecraft/world/phys/shapes/VoxelShape;Lnet/minecraft/world/phys/shapes/BooleanOp;)Z",
            at = @At("HEAD"), cancellable = true)
    private static void netherdeck$fastJoinCheck(VoxelShape shape1, VoxelShape shape2, BooleanOp op, CallbackInfoReturnable<Boolean> cir) {
        // Fast path: if both shapes are simple (single AABB), use AABB math
        if (op == BooleanOp.AND) {
            // AND operation = intersection check (most common for collision)
            if (netherdeck$isSimpleShape(shape1) && netherdeck$isSimpleShape(shape2)) {
                AABB bounds1 = shape1.bounds();
                AABB bounds2 = shape2.bounds();
                boolean intersects = bounds1.maxX > bounds2.minX && bounds1.minX < bounds2.maxX
                        && bounds1.maxY > bounds2.minY && bounds1.minY < bounds2.maxY
                        && bounds1.maxZ > bounds2.minZ && bounds1.minZ < bounds2.maxZ;
                cir.setReturnValue(intersects);
            }
        } else if (op == BooleanOp.NOT_SAME) {
            // NOT_SAME = shapes differ (used in block placement)
            if (shape1 == Shapes.empty() && shape2 == Shapes.empty()) {
                cir.setReturnValue(false);
            } else if (shape1 == Shapes.block() && shape2 == Shapes.block()) {
                cir.setReturnValue(false);
            }
        }
    }

    /**
     * Check if a VoxelShape is "simple" (represents a single AABB box).
     * Simple shapes can use fast AABB math instead of full VoxelShape operations.
     */
    @Unique
    private static boolean netherdeck$isSimpleShape(VoxelShape shape) {
        if (shape == Shapes.empty() || shape == Shapes.block()) {
            return true;
        }
        // A shape is simple if its AABB representation is exact
        // (i.e., it has exactly one box in each dimension)
        try {
            return shape.toAabbs().size() == 1;
        } catch (Exception e) {
            return false;
        }
    }
}
