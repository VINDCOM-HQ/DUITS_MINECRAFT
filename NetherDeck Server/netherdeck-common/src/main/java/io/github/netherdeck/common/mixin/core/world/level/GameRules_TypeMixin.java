package io.github.netherdeck.common.mixin.core.world.level;

import io.github.netherdeck.common.bridge.core.world.level.GameRules_TypeBridge;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.GameRules;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

import java.util.function.BiConsumer;

@Mixin(GameRules.Type.class)
public class GameRules_TypeMixin<T extends GameRules.Value<T>> implements GameRules_TypeBridge<T> {

    @Unique
    private BiConsumer<ServerLevel, T> netherdeck$perWorldCallback;

    @Override
    public void netherdeck$setPerWorldCallback(BiConsumer<ServerLevel, T> callback) {
        netherdeck$perWorldCallback = callback;
    }

    @Override
    public void netherdeck$runCallback(ServerLevel level, T value) {
        if (netherdeck$perWorldCallback != null) {
            netherdeck$perWorldCallback.accept(level, value);
        }
    }
}
