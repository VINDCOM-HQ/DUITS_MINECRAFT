package io.github.netherdeck.common.mixin.core.world.level.portal;

import io.github.netherdeck.common.bridge.core.world.level.portal.DimensionTransitionBridge;
import io.github.netherdeck.common.mod.mixins.annotation.CreateConstructor;
import io.github.netherdeck.common.mod.mixins.annotation.ShadowConstructor;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.portal.DimensionTransition;
import net.minecraft.world.phys.Vec3;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

@Mixin(DimensionTransition.class)
public class DimensionTransitionMixin implements DimensionTransitionBridge {

    @ShadowConstructor
    public void netherdeck$constructor(ServerLevel newLevel, Vec3 pos, Vec3 speed, float yRot, float xRot, boolean missingRespawnBlock, DimensionTransition.PostDimensionTransition postDimensionTransition) {
        throw new RuntimeException();
    }

    @CreateConstructor
    public void netherdeck$constructor(ServerLevel newLevel, Vec3 pos, Vec3 speed, float yRot, float xRot, boolean missingRespawnBlock, DimensionTransition.PostDimensionTransition postDimensionTransition, PlayerTeleportEvent.TeleportCause cause) {
        netherdeck$constructor(newLevel, pos, speed, yRot, xRot, missingRespawnBlock, postDimensionTransition);
        this.netherdeck$cause = cause;
    }

    @ShadowConstructor
    public void netherdeck$constructor(ServerLevel serverLevel, Vec3 vec3, Vec3 vec32, float f, float g, DimensionTransition.PostDimensionTransition postDimensionTransition) {
        throw new RuntimeException();
    }

    @CreateConstructor
    public void netherdeck$constructor(ServerLevel serverLevel, Vec3 vec3, Vec3 vec32, float f, float g, DimensionTransition.PostDimensionTransition postDimensionTransition, PlayerTeleportEvent.TeleportCause cause) {
        netherdeck$constructor(serverLevel, vec3, vec32, f, g, postDimensionTransition);
        this.netherdeck$cause = cause;
    }

    @Unique private PlayerTeleportEvent.TeleportCause netherdeck$cause;

    @Override
    public void bridge$setTeleportCause(PlayerTeleportEvent.TeleportCause cause) {
        netherdeck$cause = cause;
    }

    @Override
    public PlayerTeleportEvent.TeleportCause bridge$getTeleportCause() {
        return netherdeck$cause == null ? PlayerTeleportEvent.TeleportCause.UNKNOWN : netherdeck$cause;
    }
}
