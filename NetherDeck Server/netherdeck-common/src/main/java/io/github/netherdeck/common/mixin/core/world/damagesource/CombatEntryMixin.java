package io.github.netherdeck.common.mixin.core.world.damagesource;

import io.github.netherdeck.common.bridge.core.world.damagesource.CombatEntryBridge;
import net.minecraft.network.chat.Component;
import net.minecraft.world.damagesource.CombatEntry;
import org.spongepowered.asm.mixin.Mixin;

@Mixin(CombatEntry.class)
public class CombatEntryMixin implements CombatEntryBridge {

    private Component netherdeck$deathMessage;

    @Override
    public void bridge$setDeathMessage(Component component) {
        this.netherdeck$deathMessage = component;
    }

    @Override
    public Component bridge$getDeathMessage() {
        return this.netherdeck$deathMessage;
    }
}
