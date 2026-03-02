package io.github.netherdeck.common.mixin.netherdeck.worldmap;

import io.github.netherdeck.common.netherdeck.worldmap.MapService;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.progress.ChunkProgressListener;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Hooks the world map service into the Minecraft server lifecycle.
 * Only loaded when {@code world-map.enabled: true} in netherdeck.yml.
 */
@Mixin(MinecraftServer.class)
public abstract class MinecraftServerMixin_WorldMap {

    @Inject(method = "createLevels", at = @At("RETURN"))
    private void netherdeck$startWorldMap(ChunkProgressListener listener, CallbackInfo ci) {
        MapService.start((MinecraftServer) (Object) this);
    }

    @Inject(method = "stopServer", at = @At("HEAD"))
    private void netherdeck$stopWorldMap(CallbackInfo ci) {
        MapService.stop();
    }
}
