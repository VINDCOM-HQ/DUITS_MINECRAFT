package io.github.netherdeck.fabric.mixin.core.server;

import io.github.netherdeck.common.bridge.core.server.MinecraftServerBridge;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import org.spongepowered.asm.mixin.Mixin;

@Mixin(MinecraftServer.class)
public abstract class MinecraftServerMixin_Fabric implements MinecraftServerBridge {

    @Override
    public void netherdeck$onServerLoad(ServerLevel level) {
        ServerWorldEvents.LOAD.invoker().onWorldLoad((MinecraftServer)(Object)this, level);
    }

    @Override
    public void netherdeck$onServerUnload(ServerLevel level) {
        ServerWorldEvents.UNLOAD.invoker().onWorldUnload((MinecraftServer)(Object)this, level);
    }
}
