package io.github.netherdeck.common.mixin.netherdeck.hoppers;

import net.minecraft.world.Container;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

/**
 * Paper-style container optimization marker for hopper interactions.
 * This mixin on Container serves as a lightweight tag - the actual
 * optimization logic lives in HopperBlockEntityMixin which skips
 * empty containers at the hopper level.
 *
 * Note: We do NOT inject into Container.isEmpty() because it is a
 * default method on an interface, and concrete implementations override it,
 * making interface-level injection fragile and ineffective.
 */
@Mixin(Container.class)
public interface ContainerMixin_HopperOptimize {

    /**
     * Fast check if a container has any items, using slot iteration.
     * This is called by HopperBlockEntityMixin before attempting transfers.
     */
    @Unique
    default boolean netherdeck$hasAnyItems() {
        Container self = (Container) this;
        for (int i = 0; i < self.getContainerSize(); i++) {
            if (!self.getItem(i).isEmpty()) {
                return true;
            }
        }
        return false;
    }
}
