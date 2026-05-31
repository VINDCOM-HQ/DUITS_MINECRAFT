package io.github.netherdeck.common.bridge.core.network.login;

import com.mojang.authlib.GameProfile;
import io.github.netherdeck.common.mod.util.NetherDeckCustomQueryAnswerPayload;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.protocol.login.ServerboundCustomQueryAnswerPacket;

public interface ServerLoginPacketListenerBridge {
    default Thread bridge$newHandleThread(String name, Runnable runnable) {
        return new Thread(runnable, name);
    }

    int bridge$getVelocityLoginId();

    void bridge$preLogin(GameProfile authenticatedProfile) throws Exception;

    void bridge$disconnect(String reason);

    default FriendlyByteBuf netherdeck$platform$customQAData(ServerboundCustomQueryAnswerPacket packet) {
        return NetherDeckCustomQueryAnswerPayload.tryUnwrap(packet.payload());
    }

    default void netherdeck$platform$onCustomQA(ServerboundCustomQueryAnswerPacket payload) {}
}
