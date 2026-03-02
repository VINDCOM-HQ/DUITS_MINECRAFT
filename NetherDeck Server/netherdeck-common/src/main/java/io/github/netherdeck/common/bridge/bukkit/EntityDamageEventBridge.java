package io.github.netherdeck.common.bridge.bukkit;

import org.bukkit.event.entity.EntityDamageEvent;

import static org.bukkit.event.entity.EntityDamageEvent.DamageModifier.*;

public interface EntityDamageEventBridge {
    EntityDamageEvent.DamageModifier[] VANILLA_VALUES = new EntityDamageEvent.DamageModifier[] {
            BASE, BLOCKING, FREEZING, HARD_HAT, ARMOR, RESISTANCE, MAGIC, ABSORPTION
    };
    boolean netherdeck$applicable(EntityDamageEvent.DamageModifier stage);
    double netherdeck$applyOriginal(EntityDamageEvent.DamageModifier currentStage, double lastStage);
    boolean netherdeck$isStillOriginal(EntityDamageEvent.DamageModifier modifier, double last, double current);
}
