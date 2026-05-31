package io.github.netherdeck.common.mod.util;

import io.github.netherdeck.common.bridge.bukkit.EntityDamageEventBridge;
import org.bukkit.event.entity.EntityDamageEvent;

public class NetherDeckDamageContainer {
    private final EntityDamageEvent bukkit;
    private float currentDamage;

    public NetherDeckDamageContainer(EntityDamageEvent bukkit) {
        this.bukkit = bukkit;
        setCurrentDamage(bukkit.getDamage());
    }

    public EntityDamageEvent getBukkit() {
        return bukkit;
    }

    public float getCurrentDamage() {
        return currentDamage;
    }

    public void setCurrentDamage(double currentDamage) {
        this.currentDamage = (float) currentDamage;
    }

    public void applyOffset(double offset) {
        this.currentDamage += (float) offset;
        // Why don't we try to be branchless
        // currentDamage = (currentDamage + Float.intBitsToFloat(Float.floatToIntBits(currentDamage) & Integer.MAX_VALUE)) / 2;
        if (currentDamage < 0) {
            currentDamage = 0.0F;
        }
    }

    public float calculateStage(EntityDamageEvent.DamageModifier stage, float original) {
        final EntityDamageEventBridge bridge = (EntityDamageEventBridge) getBukkit();
        double before = getCurrentDamage();
        if (bridge.netherdeck$applicable(stage) && bridge.netherdeck$isStillOriginal(stage, before, original)) {
            // If not applicable then it won't be overridden.
            // If the offset fits vanilla result, override damage using Bukkit value
            applyOffset(getBukkit().getDamage(stage));
        } else {
            // Or else, we have to use Modded / Vanilla result
            applyOffset(original - before);
        }
        return getCurrentDamage();
    }
}
