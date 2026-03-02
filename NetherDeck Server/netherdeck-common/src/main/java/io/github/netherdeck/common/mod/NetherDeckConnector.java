package io.github.netherdeck.common.mod;

import io.github.netherdeck.api.NetherDeckPlatform;
import io.github.netherdeck.common.mod.util.log.NetherDeckI18nLogger;
import io.github.netherdeck.mixin.MixinTools;
import org.apache.logging.log4j.Logger;
import org.spongepowered.asm.mixin.Mixins;
import org.spongepowered.asm.mixin.connect.IMixinConnector;

public class NetherDeckConnector implements IMixinConnector {

    public static final Logger LOGGER = NetherDeckI18nLogger.getLogger("NetherDeck");

    @Override
    public void connect() {
        MixinTools.setup();
        Mixins.addConfiguration("mixins.netherdeck.core.json");
        Mixins.addConfiguration("mixins.netherdeck.bukkit.json");
        switch (NetherDeckPlatform.current()) {
            case VANILLA -> Mixins.addConfiguration("mixins.netherdeck.vanilla.json");
            case FORGE -> Mixins.addConfiguration("mixins.netherdeck.forge.json");
            case NEOFORGE -> Mixins.addConfiguration("mixins.netherdeck.neoforge.json");
        }
        LOGGER.info("mixin-load.core");
        Mixins.addConfiguration("mixins.netherdeck.impl.optimization.json");
        LOGGER.info("mixin-load.optimization");

        // NetherDeck performance patches (Paper ports)
        loadNetherDeckMixins();
    }

    private void loadNetherDeckMixins() {
        var config = io.github.netherdeck.common.netherdeck.NetherDeckConfig.load();
        if (config.isHopperOptimization()) {
            Mixins.addConfiguration("mixins.netherdeck.hoppers.json");
        }
        if (config.isFastutilCollections()) {
            Mixins.addConfiguration("mixins.netherdeck.collections.json");
        }
        if (config.isCollisionOptimization()) {
            Mixins.addConfiguration("mixins.netherdeck.collisions.json");
        }
        if (config.isMobSpawnOptimization()) {
            Mixins.addConfiguration("mixins.netherdeck.spawning.json");
        }
        if (config.isChunkTickOptimization()) {
            Mixins.addConfiguration("mixins.netherdeck.chunktick.json");
        }
        if (config.isAsyncChunks()) {
            Mixins.addConfiguration("mixins.netherdeck.async.json");
        }
        LOGGER.info("netherdeck-load.performance");

        // World Map (BlueMap-powered 3D map)
        if (config.isWorldMapEnabled()) {
            Mixins.addConfiguration("mixins.netherdeck.worldmap.json");
            LOGGER.info("netherdeck-load.worldmap");
        }
    }
}
