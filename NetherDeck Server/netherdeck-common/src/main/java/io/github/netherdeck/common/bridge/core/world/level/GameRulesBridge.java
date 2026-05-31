package io.github.netherdeck.common.bridge.core.world.level;

import net.minecraft.world.level.GameRules;

import java.util.Set;

public interface GameRulesBridge {
    Set<GameRules.Key<?>> netherdeck$getAllRules();
}
