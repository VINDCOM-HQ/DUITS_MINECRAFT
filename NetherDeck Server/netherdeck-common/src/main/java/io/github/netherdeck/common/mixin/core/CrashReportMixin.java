package io.github.netherdeck.common.mixin.core;

import io.github.netherdeck.api.NetherDeckVersion;
import io.github.netherdeck.common.mod.server.NetherDeckServer;
import net.minecraft.CrashReport;
import net.minecraft.SystemReport;
import org.bukkit.craftbukkit.v.CraftCrashReport;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(CrashReport.class)
public class CrashReportMixin {

    @Shadow @Final private SystemReport systemReport;

    @Inject(method = "<init>", at = @At("RETURN"))
    private void netherdeck$additional(String string, Throwable throwable, CallbackInfo ci) {
        this.systemReport.setDetail("NetherDeck Release", NetherDeckVersion.current()::getReleaseName);
        if (NetherDeckServer.isInitialized()) {
            this.systemReport.setDetail("NetherDeck", new CraftCrashReport());
        } else {
            this.systemReport.setDetail("NetherDeck", "The crash happens before the server initialization.");
        }
    }
}
