package io.github.netherdeck.neoforge.mixin.neoforge;

import io.github.netherdeck.common.mod.server.NetherDeckServer;
import io.github.netherdeck.i18n.NetherDeckConfig;
import io.github.netherdeck.neoforge.mod.permission.NetherDeckPermissionHandler;
import net.neoforged.neoforge.server.permission.PermissionAPI;
import net.neoforged.neoforge.server.permission.handler.IPermissionHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(value = PermissionAPI.class, remap = false)
public abstract class PermissionAPIMixin {

    @Shadow private static IPermissionHandler activeHandler;

    @Inject(method = "initializePermissionAPI", at = @At("RETURN"))
    private static void netherdeck$init(CallbackInfo ci) {
        if (!NetherDeckConfig.spec().getCompat().isForwardPermission()) {
            return;
        }
        var handler = new NetherDeckPermissionHandler(activeHandler);
        NetherDeckServer.LOGGER.info("Forwarding forge permission[{}] to bukkit", activeHandler.getIdentifier());
        activeHandler = handler;
    }
}
