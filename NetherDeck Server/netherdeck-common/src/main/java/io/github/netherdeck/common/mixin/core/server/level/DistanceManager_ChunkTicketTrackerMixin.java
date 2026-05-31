package io.github.netherdeck.common.mixin.core.server.level;

import io.github.netherdeck.common.bridge.core.world.server.TicketManagerBridge;
import io.github.netherdeck.mixin.Decorate;
import io.github.netherdeck.mixin.DecorationOps;
import net.minecraft.server.level.ChunkHolder;
import net.minecraft.server.level.DistanceManager;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;

import java.util.Set;

@Mixin(DistanceManager.ChunkTicketTracker.class)
public class DistanceManager_ChunkTicketTrackerMixin {
    // @formatter:off
    @Shadow(aliases = {"this$0", "f_140874_", "field_18255"}, remap = false) @Final private DistanceManager outerThis;
    // @formatter:on

    @Decorate(method = "setLevel", at = @At(value = "INVOKE", target = "Ljava/util/Set;add(Ljava/lang/Object;)Z"))
    private boolean netherdeck$setLevel(Set instance, Object e) throws Throwable {
        ((TicketManagerBridge) outerThis).netherdeck$offerUpdate((ChunkHolder) e);
        return (boolean) DecorationOps.callsite().invoke(instance, e);
    }
}
