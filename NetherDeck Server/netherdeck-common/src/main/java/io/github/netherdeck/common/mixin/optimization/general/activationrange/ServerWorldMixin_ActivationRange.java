package io.github.netherdeck.common.mixin.optimization.general.activationrange;

import io.github.netherdeck.common.bridge.core.entity.EntityBridge;
import io.github.netherdeck.common.bridge.optimization.EntityBridge_ActivationRange;
import io.github.netherdeck.i18n.NetherDeckConfig;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import org.spigotmc.ActivationRange;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.function.BooleanSupplier;

@Mixin(ServerLevel.class)
public class ServerWorldMixin_ActivationRange {

    @Unique
    private static final boolean netherdeck$applyInactive = NetherDeckConfig.spec().getOptimization().useActivationAndTrackingRange();

    @Inject(method = "tick", at = @At(value = "FIELD", target = "Lnet/minecraft/server/level/ServerLevel;entityTickList:Lnet/minecraft/world/level/entity/EntityTickList;"))
    private void activationRange$activateEntity(BooleanSupplier hasTimeLeft, CallbackInfo ci) {
        ActivationRange.activateEntities((ServerLevel) (Object) this);
    }

    @Inject(method = "tickNonPassenger", cancellable = true, at = @At(value = "HEAD"))
    private void activationRange$inactiveTick(Entity entityIn, CallbackInfo ci) {
        if (netherdeck$applyInactive && !ActivationRange.checkIfActive(entityIn)) {
            ++entityIn.tickCount;
            if (((EntityBridge) entityIn).bridge$forge$canUpdate()) {
                ((EntityBridge_ActivationRange) entityIn).bridge$inactiveTick();
            }
            ci.cancel();
        }
    }
}
