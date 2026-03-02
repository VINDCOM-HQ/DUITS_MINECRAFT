package io.github.netherdeck.common.mixin.bukkit;

import io.github.netherdeck.common.bridge.core.server.MinecraftServerBridge;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import net.minecraft.Util;
import org.spigotmc.WatchdogThread;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Overwrite;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.concurrent.locks.LockSupport;

@Mixin(value = WatchdogThread.class, remap = false)
public class WatchdogThreadMixin extends Thread {

    @Shadow private static WatchdogThread instance;

    @Inject(method = "tick", at = @At("RETURN"))
    private static void netherdeck$tick(CallbackInfo ci) {
        ((MinecraftServerBridge) NetherDeckServer.getMinecraftServer()).netherdeck$extendNextTickTimeTo(Util.timeSource);
    }

    @Inject(method = "doStop", at = @At("HEAD"))
    private static void netherdeck$doStop(CallbackInfo ci) {
        if (instance != null) instance.interrupt();
    }

    @Inject(method = "<init>", at = @At(value = "RETURN"))
    private void netherdeck$setDaemon(long timeoutTime, boolean restart, CallbackInfo ci) {
        setDaemon(true);
    }

    /**
     * @author InitAuther97
     * @reason Actually running Mojang watchdog, no need to run.
     */
    @Overwrite
    public void run() {
        NetherDeckServer.LOGGER.info("Started pseudo Spigot watchdog thread.");
        NetherDeckServer.LOGGER.debug("Spigot watchdog thread run() stack trace", new UnsupportedOperationException("started spigot watchdog"));
        while (!Thread.interrupted()) {
            LockSupport.parkNanos(Long.MAX_VALUE);
        }
    }

}
