package io.github.netherdeck.common.mixin.core.network;

import com.mojang.authlib.properties.Property;
import io.github.netherdeck.common.bridge.core.network.NetworkManagerBridge;
import net.minecraft.network.Connection;
import net.minecraft.network.DisconnectionDetails;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.UUID;

@Mixin(Connection.class)
public class ConnectionMixin implements NetworkManagerBridge {

    @Shadow public boolean disconnectionHandled;
    public java.util.UUID spoofedUUID;
    public com.mojang.authlib.properties.Property[] spoofedProfile;
    public String hostname;
    public boolean vanillaClient;

    @Override
    public UUID bridge$getSpoofedUUID() {
        return spoofedUUID;
    }

    @Override
    public void bridge$setSpoofedUUID(UUID spoofedUUID) {
        this.spoofedUUID = spoofedUUID;
    }

    @Override
    public Property[] bridge$getSpoofedProfile() {
        return spoofedProfile;
    }

    @Override
    public void bridge$setSpoofedProfile(Property[] spoofedProfile) {
        this.spoofedProfile = spoofedProfile;
    }

    @Override
    public String bridge$getHostname() {
        return hostname;
    }

    @Override
    public void bridge$setHostname(String hostname) {
        this.hostname = hostname;
    }

    @Override
    public boolean bridge$isVanillaClient() {
        return vanillaClient;
    }

    @Override
    public void bridge$setVanillaClient(boolean vanilla) {
        this.vanillaClient = vanilla;
    }

    @Inject(method = "handleDisconnection", at = @At("HEAD"), cancellable = true)
    private void netherdeck$noDisconnectTwiceWarn(CallbackInfo ci) {
        if (disconnectionHandled) {
            ci.cancel();
        }
    }
}
