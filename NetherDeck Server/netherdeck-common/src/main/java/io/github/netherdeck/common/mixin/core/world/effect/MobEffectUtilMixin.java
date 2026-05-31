package io.github.netherdeck.common.mixin.core.world.effect;

import io.github.netherdeck.common.bridge.core.entity.player.ServerPlayerEntityBridge;
import io.github.netherdeck.common.mod.util.NetherDeckCaptures;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.Local;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.effect.MobEffectUtil;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

import java.util.List;

@Mixin(MobEffectUtil.class)
public class MobEffectUtilMixin {

    @Decorate(method = "addEffectToPlayersAround", inject = true, at = @At(value = "INVOKE", remap = false, target = "Ljava/util/List;forEach(Ljava/util/function/Consumer;)V"))
    private static void netherdeck$pushCause(@Local(ordinal = -1) List<ServerPlayer> players) {
        var cause = NetherDeckCaptures.getEffectCause();
        if (cause != null) {
            for (ServerPlayer player : players) {
                ((ServerPlayerEntityBridge) player).bridge$pushEffectCause(cause);
            }
        }
    }
}
