package io.github.netherdeck.common.mixin.core.server;

import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.server.MinecraftServer;
import org.spigotmc.AsyncCatcher;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(targets = "net/minecraft/server/Main$1")
public class Main_ServerShutdownThreadMixin {

    @Decorate(method = "run", require = 0, at = @At(value = "INVOKE", target = "Lnet/minecraft/server/MinecraftServer;halt(Z)V"))
    private void netherdeck$shutdown(MinecraftServer instance, boolean b) throws Throwable {
        AsyncCatcher.enabled = false;
        DecorationOps.callsite().invoke(instance, instance.isRunning() && b);
    }
}