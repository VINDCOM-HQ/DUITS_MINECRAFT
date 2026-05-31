package io.github.netherdeck.common.mixin.core.world.damagesource;

import io.github.netherdeck.common.bridge.core.world.damagesource.CombatEntryBridge;
import io.github.netherdeck.common.bridge.core.world.damagesource.CombatTrackerBridge;
import net.minecraft.network.chat.Component;
import net.minecraft.world.damagesource.CombatEntry;
import net.minecraft.world.damagesource.CombatTracker;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.List;

@Mixin(CombatTracker.class)
public class CombatTrackerMixin implements CombatTrackerBridge {

    @Shadow @Final private List<CombatEntry> entries;

    @Unique
    private Component netherdeck$emptyComnent;

    @Inject(method = "getDeathMessage", cancellable = true, at = @At("HEAD"))
    private void netherdeck$useOverride(CallbackInfoReturnable<Component> cir) {
        if (!this.entries.isEmpty()) {
            var entry = this.entries.get(this.entries.size() - 1);
            var deathMessage = ((CombatEntryBridge) (Object) entry).bridge$getDeathMessage();
            if (deathMessage != null) {
                cir.setReturnValue(deathMessage);
            }
        } else {
            if (this.netherdeck$emptyComnent != null) {
                cir.setReturnValue(this.netherdeck$emptyComnent);
            }
        }
        this.netherdeck$emptyComnent = null;
    }

    @Override
    public void bridge$setDeathMessage(Component component) {
        this.netherdeck$emptyComnent = component;
        if (!this.entries.isEmpty()) {
            var entry = this.entries.getLast();
            ((CombatEntryBridge) (Object) entry).bridge$setDeathMessage(component);
        }
    }
}
