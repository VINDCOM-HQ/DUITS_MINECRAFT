package io.github.netherdeck.common.bridge.core.world;

import io.github.netherdeck.common.mod.util.DistValidate;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.LevelAccessor;

public interface IWorldBridge {
    static IWorldBridge from(LevelAccessor world) {
        final var result = (IWorldBridge) world;
        return result.netherdeck$isActual() ? result : null;
    }

    default boolean netherdeck$isActual() {
        return DistValidate.isValid((LevelAccessor) this);
    }

    default ServerLevel bridge$getMinecraftWorld() {
        throw new UnsupportedOperationException(String.format("No server level found for %s.\n This is likely because the specified world is not a ServerLevelAccessor and thus it shouldn't be a logic world.\n Otherwise it is a bug of NetherDeck.", getClass().getName()));
    }
}
