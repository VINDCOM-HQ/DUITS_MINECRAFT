package io.github.netherdeck.common.mixin.bukkit;

import io.github.netherdeck.common.mod.server.world.NetherDeckWorldConfig;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import org.spigotmc.SpigotWorldConfig;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(value = SpigotWorldConfig.class, remap = false)
public class SpigotWorldConfigMixin {

    @Shadow @Final private String worldName;

    @SuppressWarnings("StringEquality")
    @Decorate(method = "log", inject = true, at = @At("HEAD"))
    private void netherdeck$skipLog(String content) throws Throwable {
        if (worldName == NetherDeckWorldConfig.DEFAULT_MARKER) {
            DecorationOps.cancel().invoke();
            return;
        }
        DecorationOps.blackhole().invoke();
    }
}
