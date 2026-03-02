package io.github.netherdeck.fabric.mixin.core.network;

import io.github.netherdeck.common.bridge.bukkit.MessengerBridge;
import io.github.netherdeck.common.bridge.core.network.common.ServerCommonPacketListenerBridge;
import net.minecraft.network.protocol.common.ServerboundCustomPayloadPacket;
import net.minecraft.server.network.ServerCommonPacketListenerImpl;
import org.bukkit.Bukkit;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ServerCommonPacketListenerImpl.class)
public abstract class ServerCommonPacketListenerImplMixin_Fabric implements ServerCommonPacketListenerBridge {

    @Inject(method = "handleCustomPayload", at = @At("TAIL"))
    private void netherdeck$handleUnknownPayload(ServerboundCustomPayloadPacket packet, CallbackInfo ci) {
        var recorder = ((MessengerBridge) Bukkit.getMessenger()).netherdeck$getPacketRecorder();
        recorder.recordUnknown(packet.payload().type().id());
        recorder.update();
    }
}
