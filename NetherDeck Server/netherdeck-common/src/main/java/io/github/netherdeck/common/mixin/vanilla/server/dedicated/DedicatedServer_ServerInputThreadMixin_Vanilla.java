package io.github.netherdeck.common.mixin.vanilla.server.dedicated;

import io.github.netherdeck.common.mod.util.NetherDeckTerminalReader;
import net.minecraft.server.dedicated.DedicatedServer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(targets = "net/minecraft/server/dedicated/DedicatedServer$1")
public class DedicatedServer_ServerInputThreadMixin_Vanilla {

    @Shadow(aliases = {"field_13822", "f_139700_", "this$0"}) private DedicatedServer outerThis;

    @Inject(method = "run", cancellable = true, at = @At("HEAD"))
    private void netherdeck$terminalConsole(CallbackInfo ci) {
        if (NetherDeckTerminalReader.handleCommands(outerThis)) {
            ci.cancel();
        }
    }
}
