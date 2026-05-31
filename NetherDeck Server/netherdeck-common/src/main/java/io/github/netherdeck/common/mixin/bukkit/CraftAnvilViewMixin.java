package io.github.netherdeck.common.mixin.bukkit;

import io.github.netherdeck.common.bridge.core.inventory.AnvilMenuBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import org.bukkit.craftbukkit.v.inventory.view.CraftAnvilView;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(value = CraftAnvilView.class, remap = false)
public abstract class CraftAnvilViewMixin extends CraftInventoryViewMixin {

    @Decorate(method = "setRepairCost", at = @At("HEAD"), inject = true)
    private void netherdeck$handleZeroCost(int cost) throws Throwable {
        if (cost == 0) {
            ((AnvilMenuBridge) this.container).netherdeck$allowZeroCost();
        } else if (cost == -1) {
            cost = 0;
        }
        DecorationOps.blackhole().invoke(cost);
    }

    @Inject(method = "getRepairCost", at = @At("RETURN"), cancellable = true)
    private void netherdeck$translateToNegativeCost(CallbackInfoReturnable<Integer> cir) {
        if (cir.getReturnValueI() == 0) {
            final boolean allowed = ((AnvilMenuBridge) this.container).netherdeck$isZeroCostAllowed();
            if (!allowed) {
                cir.setReturnValue(-1);
            }
        }
    }
}
