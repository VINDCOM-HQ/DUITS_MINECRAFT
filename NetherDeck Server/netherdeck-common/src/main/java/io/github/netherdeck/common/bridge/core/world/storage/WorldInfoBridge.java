package io.github.netherdeck.common.bridge.core.world.storage;

import com.mojang.serialization.Lifecycle;
import net.minecraft.core.Registry;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.LevelSettings;
import net.minecraft.world.level.dimension.LevelStem;

public interface WorldInfoBridge {

    void bridge$setWorld(ServerLevel world);

    ServerLevel bridge$getWorld();

    LevelSettings bridge$getWorldSettings();

    Lifecycle bridge$getLifecycle();

    void netherdeck$checkName(String name);

    void netherdeck$offerCustomDimensions(Registry<LevelStem> registry);
}
