package io.github.netherdeck.common.mixin.core.world.inventory;

import io.github.netherdeck.common.bridge.core.inventory.IInventoryBridge;
import io.github.netherdeck.common.bridge.core.inventory.container.PosContainerBridge;
import net.minecraft.world.inventory.CartographyTableMenu;
import org.bukkit.Location;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;

@Mixin(targets = "net/minecraft/world/inventory/CartographyTableMenu$2")
public abstract class CartographyContainer2Mixin implements IInventoryBridge {
    @Shadow(aliases = {"this$0", "f_39182_", "field_19273"}, remap = false)
    private CartographyTableMenu outerThis;

    @Override
    public Location getLocation() {
        return ((PosContainerBridge) outerThis).bridge$getWorldLocation();
    }
}