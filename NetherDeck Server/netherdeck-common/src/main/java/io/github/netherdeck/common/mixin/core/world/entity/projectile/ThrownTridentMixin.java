package io.github.netherdeck.common.mixin.core.world.entity.projectile;

import io.github.netherdeck.common.bridge.core.entity.projectile.TridentEntityBridge;
import net.minecraft.world.entity.projectile.ThrownTrident;
import net.minecraft.world.item.ItemStack;
import org.bukkit.event.entity.EntityRemoveEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ThrownTrident.class)
public abstract class ThrownTridentMixin extends AbstractArrowMixin implements TridentEntityBridge {

    @Inject(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/entity/projectile/ThrownTrident;discard()V"))
    private void netherdeck$dropCause(CallbackInfo ci) {
        this.bridge$pushEntityRemoveCause(EntityRemoveEvent.Cause.DROP);
    }

    @Override
    public void bridge$setThrownStack(ItemStack itemStack) {
        this.pickupItemStack = itemStack;
    }
}
