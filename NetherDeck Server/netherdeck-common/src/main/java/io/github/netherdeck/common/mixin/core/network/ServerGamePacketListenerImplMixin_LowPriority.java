package io.github.netherdeck.common.mixin.core.network;

import io.github.netherdeck.common.bridge.core.network.play.ServerGamePacketListenerBridge;
import net.minecraft.server.network.ServerGamePacketListenerImpl;
import net.minecraft.world.entity.RelativeMovement;
import net.minecraft.world.phys.Vec3;
import org.objectweb.asm.Opcodes;
import org.spongepowered.asm.mixin.*;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.Set;

@Mixin(value = ServerGamePacketListenerImpl.class, priority = 1500)
public abstract class ServerGamePacketListenerImplMixin_LowPriority implements ServerGamePacketListenerBridge {

    @Shadow private Vec3 awaitingPositionFromClient;

    @Inject(method = "teleport(DDDFFLjava/util/Set;)V", at = @At(value = "FIELD", opcode = Opcodes.PUTFIELD, target = "Lnet/minecraft/server/network/ServerGamePacketListenerImpl;awaitingTeleportTime:I"))
    private void netherdeck$storeLastPosition(double d, double e, double f, float yaw, float pitch, Set<RelativeMovement> set, CallbackInfo ci) {
        netherdeck$platform$setLastPosX(this.awaitingPositionFromClient.x);
        netherdeck$platform$setLastPosY(this.awaitingPositionFromClient.y);
        netherdeck$platform$setLastPosZ(this.awaitingPositionFromClient.z);
        netherdeck$platform$setLastYaw(yaw);
        netherdeck$platform$setLastPitch(pitch);
    }
}
