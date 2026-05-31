package io.github.netherdeck.common.mixin.core.world.level.block;

import io.github.netherdeck.common.bridge.core.world.level.portal.DimensionTransitionBridge;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.block.EndGatewayBlock;
import net.minecraft.world.level.portal.DimensionTransition;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(EndGatewayBlock.class)
public class EndGatewayBlockMixin {

    @Inject(method = "getPortalDestination", at = @At("RETURN"))
    private void netherdeck$setCause(ServerLevel serverLevel, Entity entity, BlockPos blockPos, CallbackInfoReturnable<DimensionTransition> cir) {
        var dimensionTransition = cir.getReturnValue();
        if (dimensionTransition != null) {
            ((DimensionTransitionBridge) ((Object) dimensionTransition)).bridge$setTeleportCause(PlayerTeleportEvent.TeleportCause.END_GATEWAY);
        }
    }
}
