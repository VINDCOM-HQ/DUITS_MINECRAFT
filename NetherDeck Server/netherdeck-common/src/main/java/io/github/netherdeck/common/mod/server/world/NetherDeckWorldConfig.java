package io.github.netherdeck.common.mod.server.world;

import io.github.netherdeck.common.mixin.core.world.level.LevelMixin;
import org.spigotmc.SpigotWorldConfig;

public class NetherDeckWorldConfig {

    /**
     * Use as a marker world name. We don't want to put trash output in terminal
     * only for reading a default world config.
     * @see io.github.netherdeck.common.mixin.bukkit.SpigotWorldConfigMixin#netherdeck$skipLog(String)
     */
    @SuppressWarnings({"StringOperationCanBeSimplified", "JavadocReference"})
    public static final String DEFAULT_MARKER = new String("default");

    /**
     * Default world config. Used for logic world.
     * @see LevelMixin#bridge$spigotConfig()
     */
    public static final SpigotWorldConfig DEFAULT = new SpigotWorldConfig(DEFAULT_MARKER);

    private NetherDeckWorldConfig() {}
}
