package io.github.netherdeck.neoforge.mixin.core.network;

import io.github.netherdeck.common.bridge.core.network.common.ServerCommonPacketListenerBridge;
import net.minecraft.network.Connection;
import net.minecraft.server.network.ServerCommonPacketListenerImpl;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;

@Mixin(ServerCommonPacketListenerImpl.class)
public abstract class ServerCommonPacketListenerImplMixin_NeoForge implements ServerCommonPacketListenerBridge {

    @Shadow @Final public Connection connection;

}
