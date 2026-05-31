package io.github.netherdeck.common.bridge.core.world.level;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.GameRules;

import java.util.function.BiConsumer;

public interface GameRules_TypeBridge<T extends GameRules.Value<T>> {
    void netherdeck$setPerWorldCallback(BiConsumer<ServerLevel, T> callback);
    void netherdeck$runCallback(ServerLevel level, T value);
}
