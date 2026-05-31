package io.github.netherdeck.neoforge.mixin.neoforge;

import io.github.netherdeck.neoforge.mod.network.VanillaConnectionContext;
import io.github.netherdeck.neoforge.mod.plugin.messaging.NetherDeckNfMessaging;
import net.neoforged.neoforge.network.negotiation.NetworkComponentNegotiator;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.Slice;

@Mixin(value = NetworkComponentNegotiator.class, remap = false)
public abstract class NetworkComponentNegotiatorMixin {
    @SuppressWarnings("StringEquality")
    @Redirect(
            method = "validateComponent",
            slice = @Slice(
                    from = @At(
                            value = "INVOKE",
                            ordinal = 1,
                            target = "Lnet/neoforged/neoforge/network/negotiation/NegotiableNetworkComponent;version()Ljava/lang/String;"
                    ),
                    to = @At(
                            value = "INVOKE",
                            ordinal = 2,
                            target = "Lnet/neoforged/neoforge/network/negotiation/NegotiableNetworkComponent;version()Ljava/lang/String;"
                    )
            ),
            at = @At(
                    value = "INVOKE",
                    target = "Ljava/lang/String;equals(Ljava/lang/Object;)Z"
            )
    )
    private static boolean netherdeck$bypassValidation(String instance, Object o) {
        if (VanillaConnectionContext.isVanilla()) {
            return true;
        }
        if (instance == NetherDeckNfMessaging.NETHERDECK_CUSTOM_CHANNEL_VERSION || o == NetherDeckNfMessaging.NETHERDECK_CUSTOM_CHANNEL_VERSION) {
            return true;
        }
        return instance.equals(o);
    }
}
