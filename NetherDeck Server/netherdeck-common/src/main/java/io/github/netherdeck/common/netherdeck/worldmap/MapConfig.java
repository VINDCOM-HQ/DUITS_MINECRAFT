package io.github.netherdeck.common.netherdeck.worldmap;

import io.github.netherdeck.common.netherdeck.NetherDeckConfig;

/**
 * Typed, immutable snapshot of the world-map configuration section.
 * Parsed from {@link NetherDeckConfig} at startup.
 */
public record MapConfig(
        boolean enabled,
        int httpPort,
        String httpBind,
        int renderThreads,
        int renderDistance,
        int updateInterval,
        boolean overworld,
        boolean nether,
        boolean theEnd
) {

    public static MapConfig fromConfig(NetherDeckConfig config) {
        return new MapConfig(
                config.isWorldMapEnabled(),
                config.getWorldMapHttpPort(),
                config.getWorldMapHttpBind(),
                config.getWorldMapRenderThreads(),
                config.getWorldMapRenderDistance(),
                config.getWorldMapUpdateInterval(),
                config.isWorldMapOverworld(),
                config.isWorldMapNether(),
                config.isWorldMapTheEnd()
        );
    }
}
